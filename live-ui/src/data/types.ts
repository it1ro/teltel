/**
 * Event Model типы
 * Соответствуют backend Event Model из teltel
 */

export interface Event {
  v: number;
  runId: string;
  sourceId: string;
  channel: string;
  type: string;
  frameIndex: number;
  simTime: number;
  wallTimeMs?: number | null;
  tags?: Record<string, string>;
  payload: unknown; // JSON payload, не парсится в Data Layer
}

/**
 * Валидация базовой структуры события
 */
export function validateEvent(data: unknown): data is Event {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const event = data as Record<string, unknown>;

  return (
    typeof event.v === 'number' &&
    typeof event.runId === 'string' &&
    event.runId !== '' &&
    typeof event.sourceId === 'string' &&
    event.sourceId !== '' &&
    typeof event.channel === 'string' &&
    typeof event.type === 'string' &&
    typeof event.frameIndex === 'number' &&
    event.frameIndex >= 0 &&
    typeof event.simTime === 'number' &&
    event.simTime >= 0 &&
    (event.wallTimeMs === null ||
      event.wallTimeMs === undefined ||
      typeof event.wallTimeMs === 'number') &&
    (event.tags === undefined ||
      event.tags === null ||
      typeof event.tags === 'object') &&
    event.payload !== undefined
  );
}

/**
 * WebSocket запрос на подписку
 */
export interface WSRequest {
  runId?: string;
  sourceId?: string;
  channel?: string;
  types?: string[];
  tags?: Record<string, string>;
}

/**
 * Точка данных для визуализации
 */
export interface DataPoint {
  x: number; // frameIndex или simTime
  y: number; // значение из payload
  frameIndex: number;
  simTime: number;
  event: Event; // полное событие для дополнительных данных
}

/**
 * Серия данных для графика
 */
export interface Series {
  id: string;
  points: DataPoint[];
}
