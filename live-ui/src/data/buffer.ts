/**
 * Live Buffer - хранение событий в памяти
 * Индексирование по runId, channel, type, frameIndex, simTime
 * Поддержка нескольких run'ов
 */

import type { Event } from './types';

/**
 * Live Buffer для хранения событий
 */
export class LiveBuffer {
  private events: Event[] = [];
  private indexByRun: Map<string, Event[]> = new Map();
  private indexByChannel: Map<string, Event[]> = new Map();
  private indexByType: Map<string, Event[]> = new Map();

  /**
   * Добавление события в buffer
   */
  add(event: Event): void {
    this.events.push(event);

    // Индексирование по runId
    const runEvents = this.indexByRun.get(event.runId) || [];
    runEvents.push(event);
    this.indexByRun.set(event.runId, runEvents);

    // Индексирование по channel
    const channelEvents = this.indexByChannel.get(event.channel) || [];
    channelEvents.push(event);
    this.indexByChannel.set(event.channel, channelEvents);

    // Индексирование по type
    const typeEvents = this.indexByType.get(event.type) || [];
    typeEvents.push(event);
    this.indexByType.set(event.type, typeEvents);
  }

  /**
   * Получение всех событий
   */
  getAll(): Event[] {
    return [...this.events];
  }

  /**
   * Получение событий по runId
   */
  getByRunId(runId: string): Event[] {
    return [...(this.indexByRun.get(runId) || [])];
  }

  /**
   * Получение событий по channel
   */
  getByChannel(channel: string): Event[] {
    return [...(this.indexByChannel.get(channel) || [])];
  }

  /**
   * Получение событий по type
   */
  getByType(type: string): Event[] {
    return [...(this.indexByType.get(type) || [])];
  }

  /**
   * Фильтрация событий по критериям
   */
  filter(filters: {
    runId?: string | null;
    channel?: string | null;
    type?: string | null;
    types?: string[];
    typePrefix?: string | null;
    tags?: Record<string, string>;
  }): Event[] {
    let result = this.events;

    // Фильтр по runId
    if (filters.runId) {
      result = result.filter((e) => e.runId === filters.runId);
    }

    // Фильтр по channel
    if (filters.channel) {
      result = result.filter((e) => e.channel === filters.channel);
    }

    // Фильтр по type
    if (filters.type) {
      result = result.filter((e) => e.type === filters.type);
    }

    // Фильтр по types (массив)
    if (filters.types && filters.types.length > 0) {
      result = result.filter((e) => filters.types!.includes(e.type));
    }

    // Фильтр по typePrefix
    if (filters.typePrefix) {
      result = result.filter((e) => e.type.startsWith(filters.typePrefix!));
    }

    // Фильтр по tags
    if (filters.tags) {
      result = result.filter((e) => {
        if (!e.tags) {
          return false;
        }
        for (const [key, value] of Object.entries(filters.tags!)) {
          if (e.tags[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return result;
  }

  /**
   * Очистка старых событий (для window logic)
   */
  removeEvents(predicate: (event: Event) => boolean): void {
    const toKeep = this.events.filter((e) => !predicate(e));

    this.events = toKeep;

    // Пересоздание индексов
    this.rebuildIndexes();
  }

  /**
   * Очистка всех событий
   */
  clear(): void {
    this.events = [];
    this.indexByRun.clear();
    this.indexByChannel.clear();
    this.indexByType.clear();
  }

  /**
   * Пересоздание индексов
   */
  private rebuildIndexes(): void {
    this.indexByRun.clear();
    this.indexByChannel.clear();
    this.indexByType.clear();

    for (const event of this.events) {
      // Индексирование по runId
      const runEvents = this.indexByRun.get(event.runId) || [];
      runEvents.push(event);
      this.indexByRun.set(event.runId, runEvents);

      // Индексирование по channel
      const channelEvents = this.indexByChannel.get(event.channel) || [];
      channelEvents.push(event);
      this.indexByChannel.set(event.channel, channelEvents);

      // Индексирование по type
      const typeEvents = this.indexByType.get(event.type) || [];
      typeEvents.push(event);
      this.indexByType.set(event.type, typeEvents);
    }
  }

  /**
   * Получение статистики buffer
   */
  getStats(): {
    totalEvents: number;
    runs: string[];
    channels: string[];
    types: string[];
  } {
    const runs = Array.from(this.indexByRun.keys());
    const channels = Array.from(this.indexByChannel.keys());
    const types = Array.from(this.indexByType.keys());

    return {
      totalEvents: this.events.length,
      runs,
      channels,
      types,
    };
  }
}
