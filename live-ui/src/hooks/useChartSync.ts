/**
 * useChartSync - hook для синхронизации интерактивных состояний между графиками
 * Stage 7.7: Синхронизация интерактивности между графиками
 * 
 * Определяет группы синхронизации из shared_state.time_cursor.sync_across
 * Подписывается на shared_state
 * Применяет синхронизированные состояния к графикам
 * 
 * Синхронизация опциональна, по умолчанию графики независимы
 */

import { useMemo } from 'react';
import { useSharedState } from '../context/SharedStateContext';
import type { ChartSpec } from '../types';

interface ChartSyncInfo {
  /**
   * ID графика
   */
  chartId: string;
  /**
   * Список ID графиков, с которыми синхронизируется этот график
   */
  syncGroup: string[];
  /**
   * Синхронизируется ли hover
   */
  syncHover: boolean;
  /**
   * Синхронизируется ли time_cursor
   */
  syncTimeCursor: boolean;
  /**
   * Синхронизируется ли zoom/pan
   */
  syncZoomPan: boolean;
}

interface UseChartSyncOptions {
  /**
   * ChartSpec текущего графика
   */
  chartSpec: ChartSpec;
  /**
   * Все ChartSpec'ы для определения групп синхронизации (опционально)
   * Если не указано, используется упрощенная логика на основе sync_across
   */
  allChartIds?: string[];
}

/**
 * useChartSync определяет, с какими графиками синхронизируется текущий график
 * 
 * Группы синхронизации определяются из shared_state.time_cursor.sync_across
 * Если sync_across содержит "main_panel.charts", все графики синхронизируются
 * Если графики в одной группе, они синхронизируются по:
 * - time_cursor (обязательно, если указано в sync_across)
 * - hover (опционально, если графики в одной группе)
 * - zoom/pan (опционально, если графики в одной группе)
 * 
 * @returns информация о синхронизации для текущего графика
 */
export const useChartSync = ({
  chartSpec,
  allChartIds,
}: UseChartSyncOptions): ChartSyncInfo => {
  const { sharedState } = useSharedState();

  // Определяем группы синхронизации из shared_state
  const syncInfo = useMemo(() => {
    // Получаем sync_across из shared_state.time_cursor
    const syncAcross = sharedState.time_cursor?.sync_across || [];
    
    // Если sync_across содержит "main_panel.charts", все графики синхронизируются
    let syncGroup: string[] = [chartSpec.chart_id];
    
    if (syncAcross.includes('main_panel.charts')) {
      // Если указаны все ID графиков, используем их
      if (allChartIds && allChartIds.length > 0) {
        syncGroup = allChartIds;
      } else {
        // Иначе, считаем, что все графики синхронизируются
        // (в реальности это будет определено на уровне выше)
        syncGroup = [chartSpec.chart_id];
      }
    }
    
    // Определяем, синхронизируется ли hover и zoom/pan
    // По умолчанию, если графики в одной группе (больше одного графика), они синхронизируются
    const syncHover = syncGroup.length > 1;
    const syncZoomPan = syncGroup.length > 1;
    
    // time_cursor синхронизируется, если указано в sync_across
    const syncTimeCursor = syncAcross.length > 0;

    return {
      chartId: chartSpec.chart_id,
      syncGroup,
      syncHover,
      syncTimeCursor,
      syncZoomPan,
    };
  }, [chartSpec.chart_id, sharedState.time_cursor?.sync_across, allChartIds]);

  return syncInfo;
};
