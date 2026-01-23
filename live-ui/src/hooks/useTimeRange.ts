/**
 * useTimeRange - hook для получения диапазона времени из Data Layer
 * Stage 7.6: Manual Time Scrubbing
 * 
 * Получает min/max frameIndex или simTime из данных для selected_run
 * Hook использует Data Layer ТОЛЬКО для чтения
 * Hook не хранит состояние
 */

import { useMemo } from 'react';
import { useDataLayerContext } from '../context/DataLayerContext';
import { useSharedState } from '../context/SharedStateContext';
import type { Event } from '../data/types';

/**
 * Диапазон времени
 */
export interface TimeRange {
  min: number;
  max: number;
}

/**
 * useTimeRange возвращает диапазон времени для текущего selected_run и axis
 * 
 * @returns объект с min и max значениями, или null если данных нет
 */
export const useTimeRange = (): TimeRange | null => {
  const dataLayer = useDataLayerContext();
  const { sharedState } = useSharedState();
  
  const selectedRunId = sharedState.selected_run?.run_id;
  const axis = sharedState.time_cursor?.axis ?? 'frameIndex';

  const range = useMemo(() => {
    if (!dataLayer) {
      return null;
    }

    // Получаем все события из buffer
    const allEvents = dataLayer.getAllEvents();

    if (allEvents.length === 0) {
      return null;
    }

    // Фильтруем по selected_run, если он указан
    let events: Event[] = allEvents;
    if (selectedRunId) {
      events = events.filter((e) => e.runId === selectedRunId);
    }

    if (events.length === 0) {
      return null;
    }

    // Находим min и max по axis
    let min: number;
    let max: number;

    if (axis === 'frameIndex') {
      min = events.reduce((acc, e) => Math.min(acc, e.frameIndex), events[0].frameIndex);
      max = events.reduce((acc, e) => Math.max(acc, e.frameIndex), events[0].frameIndex);
    } else {
      // axis === 'simTime'
      min = events.reduce((acc, e) => Math.min(acc, e.simTime), events[0].simTime);
      max = events.reduce((acc, e) => Math.max(acc, e.simTime), events[0].simTime);
    }

    return { min, max };
  }, [dataLayer, selectedRunId, axis]);

  return range;
};
