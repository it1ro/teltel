/**
 * HTTP клиент для Analysis API
 * Загрузка исторических данных из ClickHouse через backend API
 */

import type { Event } from './types';

/**
 * Метаданные run'а
 */
export interface RunMetadata {
  run_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  total_events?: number | null;
  total_frames?: number | null;
  max_frame_index?: number | null;
  source_id?: string | null;
  config?: unknown;
  engine_version?: string | null;
  seed?: number | null;
  end_reason?: string | null;
  tags?: Record<string, string> | null;
}

/**
 * Параметры запроса списка run'ов
 */
export interface GetRunsParams {
  sourceId?: string;
  status?: string;
  daysBack?: number;
}

/**
 * Параметры запроса временного ряда
 */
export interface GetSeriesParams {
  runId: string;
  eventType: string;
  sourceId: string;
  jsonPath: string;
}

/**
 * Параметры запроса сравнения run'ов
 */
export interface CompareRunsParams {
  runId1: string;
  runId2: string;
  eventType: string;
  sourceId: string;
  jsonPath: string;
}

/**
 * Точка данных из временного ряда
 */
export interface SeriesDataPoint {
  frame_index: number;
  sim_time: number;
  value: number;
}

/**
 * Точка данных из сравнения run'ов
 */
export interface CompareDataPoint {
  frame_index: number;
  sim_time_1: number;
  sim_time_2: number;
  value_1: number;
  value_2: number;
  diff: number;
}

/**
 * Парсинг JSONEachRow формата (каждая строка - отдельный JSON объект)
 */
function parseJSONEachRow<T>(text: string): T[] {
  if (!text || text.trim() === '') {
    return [];
  }

  const lines = text.trim().split('\n');
  const results: T[] = [];

  for (const line of lines) {
    if (line.trim() === '') {
      continue;
    }

    try {
      const parsed = JSON.parse(line) as T;
      results.push(parsed);
    } catch (error) {
      console.warn('Failed to parse JSON line:', line, error);
    }
  }

  return results;
}

/**
 * HTTP клиент для Analysis API
 * Использует относительные пути для работы через nginx proxy
 */
export class AnalysisClient {
  constructor() {
    // Больше не нужен baseUrl, используем относительные пути
  }

  /**
   * Получение списка run'ов
   */
  async getRuns(params?: GetRunsParams): Promise<RunMetadata[]> {
    const queryParams = new URLSearchParams();
    if (params?.sourceId) {
      queryParams.set('sourceId', params.sourceId);
    }
    if (params?.status) {
      queryParams.set('status', params.status);
    }
    if (params?.daysBack !== undefined) {
      queryParams.set('daysBack', params.daysBack.toString());
    }

    const url = `/api/analysis/runs${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return parseJSONEachRow<RunMetadata>(text);
    } catch (error) {
      console.error('Failed to fetch runs:', error);
      throw error;
    }
  }

  /**
   * Получение метаданных конкретного run'а
   */
  async getRun(runId: string): Promise<RunMetadata | null> {
    const url = `/api/analysis/run/${encodeURIComponent(runId)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const runs = parseJSONEachRow<RunMetadata>(text);
      return runs.length > 0 ? runs[0] : null;
    } catch (error) {
      console.error(`Failed to fetch run ${runId}:`, error);
      throw error;
    }
  }

  /**
   * Получение временного ряда для run'а
   */
  async getSeries(params: GetSeriesParams): Promise<SeriesDataPoint[]> {
    const queryParams = new URLSearchParams({
      runId: params.runId,
      eventType: params.eventType,
      sourceId: params.sourceId,
      jsonPath: params.jsonPath,
    });

    const url = `/api/analysis/series?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return parseJSONEachRow<SeriesDataPoint>(text);
    } catch (error) {
      console.error('Failed to fetch series:', error);
      throw error;
    }
  }

  /**
   * Сравнение двух run'ов
   */
  async compareRuns(params: CompareRunsParams): Promise<CompareDataPoint[]> {
    const queryParams = new URLSearchParams({
      runId1: params.runId1,
      runId2: params.runId2,
      eventType: params.eventType,
      sourceId: params.sourceId,
      jsonPath: params.jsonPath,
    });

    const url = `/api/analysis/compare?${queryParams.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      return parseJSONEachRow<CompareDataPoint>(text);
    } catch (error) {
      console.error('Failed to compare runs:', error);
      throw error;
    }
  }

  /**
   * Преобразование SeriesDataPoint в Event для совместимости с Data Layer
   * Это упрощённое преобразование, так как исторические данные не содержат полной информации
   */
  seriesToEvents(
    points: SeriesDataPoint[],
    runId: string,
    sourceId: string,
    channel: string,
    type: string
  ): Event[] {
    return points.map((point) => ({
      v: 1,
      runId,
      sourceId,
      channel,
      type,
      frameIndex: point.frame_index,
      simTime: point.sim_time,
      wallTimeMs: null,
      tags: {},
      payload: { value: point.value },
    }));
  }
}

/**
 * Singleton экземпляр Analysis клиента
 */
let analysisClientInstance: AnalysisClient | null = null;

/**
 * Получение singleton экземпляра Analysis клиента
 */
export function getAnalysisClient(): AnalysisClient {
  if (!analysisClientInstance) {
    analysisClientInstance = new AnalysisClient();
  }
  return analysisClientInstance;
}
