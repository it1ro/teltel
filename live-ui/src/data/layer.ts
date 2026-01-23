/**
 * Data Layer - главный класс, объединяющий все компоненты
 * WebSocket + Ingestion + Buffer + Window + Adapter + Analysis API
 */

import type { Event, WSRequest, Series } from './types';
import type { ChartSpec } from '../types';
import { validateEvent } from './types';
import { WSClient, type WSConnectionState } from './websocket';
import { LiveBuffer } from './buffer';
import { getSeries } from './adapter';
import { getWindowPredicate } from './window';
import { getWebSocketUrl } from '../utils/config';
import {
  getAnalysisClient,
  type AnalysisClient,
} from './analysis';

export interface DataLayerCallbacks {
  onStateChange?: (state: WSConnectionState) => void;
  onError?: (error: Error) => void;
}

/**
 * Data Layer - основной класс для работы с данными
 */
export class DataLayer {
  private wsClient: WSClient;
  private buffer: LiveBuffer;
  private callbacks: DataLayerCallbacks;
  private analysisClient: AnalysisClient;
  private historicalCache: Map<string, Event[]> = new Map();

  constructor(callbacks?: DataLayerCallbacks) {
    this.buffer = new LiveBuffer();
    this.callbacks = callbacks || {};
    this.analysisClient = getAnalysisClient();

    // Создаем WebSocket клиент с конфигурацией из env vars
    this.wsClient = new WSClient(
      {
        onEvent: (event) => this.handleEvent(event),
        onStateChange: (state) => {
          if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange(state);
          }
        },
        onError: (error) => {
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
        },
      },
      {
        url: getWebSocketUrl(),
        reconnect: true,
        reconnectDelay: 1000,
        maxReconnectAttempts: 10,
      }
    );
  }

  /**
   * Обработка события из WebSocket (ingestion pipeline)
   */
  private handleEvent(data: unknown): void {
    // Валидация базовой структуры
    if (!validateEvent(data)) {
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error('Invalid event structure'));
      }
      return;
    }

    const event = data as Event;

    // Маршрутизация в Live Buffer
    this.buffer.add(event);

    // Применение window logic (удаление старых данных)
    // Это делается при чтении данных, но можно также периодически чистить buffer
  }

  /**
   * Подключение к WebSocket с подпиской
   */
  connect(request: WSRequest): void {
    this.wsClient.connect(request);
  }

  /**
   * Обновление подписки
   */
  updateSubscription(request: WSRequest): void {
    this.wsClient.updateSubscription(request);
  }

  /**
   * Отключение от WebSocket
   */
  disconnect(): void {
    this.wsClient.disconnect();
  }

  /**
   * Получение состояния подключения
   */
  getConnectionState(): WSConnectionState {
    return this.wsClient.getState();
  }

  /**
   * Получение серии данных для графика
   * Поддерживает live, historical и hybrid режимы
   */
  async getSeries(chartSpec: ChartSpec): Promise<Series[]> {
    const { data_source } = chartSpec;

    let events: Event[] = [];

    // Определяем источник данных
    if (data_source.type === 'historical' || data_source.type === 'hybrid') {
      // Загружаем исторические данные
      const historicalEvents = await this.loadHistoricalData(chartSpec);
      events.push(...historicalEvents);
    }

    if (data_source.type === 'event_stream' || data_source.type === 'hybrid') {
      // Получаем live данные из buffer
      const liveEvents = this.buffer.filter({
        runId: data_source.run_id || undefined,
        channel: data_source.filters?.channel || undefined,
        type: data_source.filters?.type || undefined,
        types: data_source.filters?.types,
        typePrefix: data_source.filters?.type_prefix || undefined,
        tags: data_source.filters?.tags,
      });
      events.push(...liveEvents);
    }

    // Применение window и преобразование в Series
    return getSeries(events, chartSpec);
  }

  /**
   * Загрузка исторических данных через Analysis API
   */
  private async loadHistoricalData(chartSpec: ChartSpec): Promise<Event[]> {
    const { data_source } = chartSpec;
    const { filters } = data_source;

    if (!filters?.sourceId || !filters?.type || !filters?.jsonPath) {
      console.warn(
        'Historical data source requires sourceId, type, and jsonPath filters'
      );
      return [];
    }

    // Определяем run'ы для загрузки
    const runIds = data_source.run_ids || (data_source.run_id ? [data_source.run_id] : []);

    if (runIds.length === 0) {
      console.warn('No run IDs specified for historical data');
      return [];
    }

    // Загружаем данные для каждого run'а
    const allEvents: Event[] = [];

    for (const runId of runIds) {
      const cacheKey = `${runId}-${filters.type}-${filters.sourceId}-${filters.jsonPath}`;
      
      // Проверяем кэш
      if (this.historicalCache.has(cacheKey)) {
        const cached = this.historicalCache.get(cacheKey);
        if (cached) {
          allEvents.push(...cached);
          continue;
        }
      }

      try {
        // Загружаем через Analysis API
        const seriesData = await this.analysisClient.getSeries({
          runId,
          eventType: filters.type,
          sourceId: filters.sourceId,
          jsonPath: filters.jsonPath,
        });

        // Преобразуем в Event формат
        const channel = filters.channel || 'default';
        const events = this.analysisClient.seriesToEvents(
          seriesData,
          runId,
          filters.sourceId,
          channel,
          filters.type
        );

        // Кэшируем
        this.historicalCache.set(cacheKey, events);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Failed to load historical data for run ${runId}:`, error);
        if (this.callbacks.onError) {
          this.callbacks.onError(
            new Error(`Failed to load historical data for run ${runId}: ${error}`)
          );
        }
      }
    }

    return allEvents;
  }

  /**
   * Очистка кэша исторических данных
   */
  clearHistoricalCache(): void {
    this.historicalCache.clear();
  }

  /**
   * Получение всех событий (для отладки)
   */
  getAllEvents(): Event[] {
    return this.buffer.getAll();
  }

  /**
   * Получение статистики buffer
   */
  getStats() {
    return this.buffer.getStats();
  }

  /**
   * Очистка buffer
   */
  clear(): void {
    this.buffer.clear();
  }

  /**
   * Применение window cleanup (удаление старых данных)
   * Вызывается периодически или при необходимости
   */
  cleanupWindow(chartSpec: ChartSpec): void {
    const allEvents = this.buffer.getAll();
    const predicate = getWindowPredicate(chartSpec.data_source.window, allEvents);

    if (predicate) {
      this.buffer.removeEvents(predicate);
    }
  }
}
