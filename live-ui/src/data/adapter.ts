/**
 * Data Adapter - чтение данных из Live Buffer
 * Преобразование событий в формат для визуализации
 * Не содержит логики рендера
 */

import type { ChartSpec } from '../types';
import type { Event, DataPoint, Series } from './types';
import { applyWindow } from './window';

/**
 * Извлечение значения из payload по пути
 */
function getPayloadValue(payload: unknown, path: string): number | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const parts = path.split('.');
  let current: unknown = payload;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return null;
    }

    if (typeof current !== 'object') {
      return null;
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current === 'number') {
    return current;
  }

  return null;
}

/**
 * Извлечение значения X из события
 */
function getXValue(event: Event, field: string): number | null {
  if (field === 'frameIndex') {
    return event.frameIndex;
  }

  if (field === 'simTime') {
    return event.simTime;
  }

  if (field.startsWith('payload.')) {
    const path = field.substring('payload.'.length);
    return getPayloadValue(event.payload, path);
  }

  return null;
}

/**
 * Извлечение значения Y из события
 */
function getYValue(event: Event, field: string): number | null {
  if (field.startsWith('payload.')) {
    const path = field.substring('payload.'.length);
    return getPayloadValue(event.payload, path);
  }

  return null;
}

/**
 * Получение серии данных для графика
 */
export function getSeries(
  events: Event[],
  chartSpec: ChartSpec
): Series[] {
  const { data_source, mappings } = chartSpec;

  // Применяем window
  const windowedEvents = applyWindow(events, data_source.window);

  if (windowedEvents.length === 0) {
    return [];
  }

  // Если есть series в chartSpec, обрабатываем каждую series отдельно
  if (chartSpec.series && chartSpec.series.length > 0) {
    return chartSpec.series.map((seriesSpec) => {
      const seriesDataSource = seriesSpec.data_source
        ? (seriesSpec.data_source as ChartSpec['data_source'])
        : data_source;
      const seriesEvents = filterEventsForSeries(
        windowedEvents,
        seriesDataSource
      );

      const seriesMappings = seriesSpec.mappings as
        | ChartSpec['mappings']
        | undefined;
      const points = seriesEvents
        .map((event) => {
          const xMapping = seriesMappings?.x || mappings?.x;
          const yMapping = seriesMappings?.y || mappings?.y;

          if (!xMapping || !yMapping) {
            return null;
          }

          const x = getXValue(event, xMapping.field);
          const y = getYValue(event, yMapping.field);

          if (x === null || y === null) {
            return null;
          }

          return {
            x,
            y,
            frameIndex: event.frameIndex,
            simTime: event.simTime,
            event,
          } as DataPoint;
        })
        .filter((p): p is DataPoint => p !== null);

      return {
        id: seriesSpec.id,
        points,
      };
    });
  }

  // Одна серия для всего графика
  const xMapping = mappings?.x;
  const yMapping = mappings?.y;

  if (!xMapping || !yMapping) {
    return [];
  }

  // Этап 8: Поддержка множественных run'ов
  // Если указаны run_ids, создаем отдельную series для каждого run'а
  if (data_source.run_ids && data_source.run_ids.length > 1) {
    return data_source.run_ids.map((runId) => {
      const runEvents = windowedEvents.filter((event) => event.runId === runId);
      const points = runEvents
        .map((event) => {
          const x = getXValue(event, xMapping.field);
          const y = getYValue(event, yMapping.field);

          if (x === null || y === null) {
            return null;
          }
          return {
            x,
            y,
            frameIndex: event.frameIndex,
            simTime: event.simTime,
            event,
          } as DataPoint;
        })
        .filter((p): p is DataPoint => p !== null);

      return {
        id: `${chartSpec.chart_id}-${runId}`,
        points,
      };
    });
  }

  // Одна серия для одного run'а или без указания run_ids
  const points = windowedEvents
    .map((event) => {
      const x = getXValue(event, xMapping.field);
      const y = getYValue(event, yMapping.field);

      if (x === null || y === null) {
        return null;
      }
      return {
        x,
        y,
        frameIndex: event.frameIndex,
        simTime: event.simTime,
        event,
      } as DataPoint;
    })
    .filter((p): p is DataPoint => p !== null);

  // Если есть run_id, включаем его в id series для идентификации
  const seriesId = data_source.run_id
    ? `${chartSpec.chart_id}-${data_source.run_id}`
    : chartSpec.chart_id;

  return [
    {
      id: seriesId,
      points,
    },
  ];
}

/**
 * Фильтрация событий для series
 */
function filterEventsForSeries(
  events: Event[],
  dataSource: ChartSpec['data_source']
): Event[] {
  const { filters } = dataSource;

  if (!filters) {
    return events;
  }

  return events.filter((event) => {
    // Фильтр по channel
    if (filters.channel && event.channel !== filters.channel) {
      return false;
    }

    // Фильтр по type
    if (filters.type && event.type !== filters.type) {
      return false;
    }

    // Фильтр по types (массив)
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(event.type)) {
        return false;
      }
    }

    // Фильтр по typePrefix
    if (filters.type_prefix && !event.type.startsWith(filters.type_prefix)) {
      return false;
    }

    // Фильтр по tags
    if (filters.tags) {
      if (!event.tags) {
        return false;
      }
      for (const [key, value] of Object.entries(filters.tags)) {
        if (event.tags[key] !== value) {
          return false;
        }
      }
    }

    return true;
  });
}
