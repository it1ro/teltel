/**
 * Data Layer - главный класс, объединяющий все компоненты
 * WebSocket + Ingestion + Buffer + Window + Adapter
 */

import type { Event, WSRequest, Series } from './types';
import type { ChartSpec } from '../types';
import { validateEvent } from './types';
import { WSClient, type WSConnectionState } from './websocket';
import { LiveBuffer } from './buffer';
import { getSeries } from './adapter';
import { getWindowPredicate } from './window';

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

  constructor(callbacks?: DataLayerCallbacks) {
    this.buffer = new LiveBuffer();
    this.callbacks = callbacks || {};

    // Создаем WebSocket клиент
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
   */
  getSeries(chartSpec: ChartSpec): Series[] {
    const { data_source } = chartSpec;

    // Фильтрация событий по критериям из ChartSpec
    const filteredEvents = this.buffer.filter({
      runId: data_source.run_id || undefined,
      channel: data_source.filters?.channel || undefined,
      type: data_source.filters?.type || undefined,
      types: data_source.filters?.types,
      typePrefix: data_source.filters?.type_prefix || undefined,
      tags: data_source.filters?.tags,
    });

    // Применение window и преобразование в Series
    return getSeries(filteredEvents, chartSpec);
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
