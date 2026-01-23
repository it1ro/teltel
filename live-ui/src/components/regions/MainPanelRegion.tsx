/**
 * MainPanelRegion - компонент для отображения main panel региона
 * Рендерит grid layout с графиками через ChartRenderer
 */

import React from 'react';
import type { MainPanelRegion as MainPanelRegionType, ChartSpec } from '../../types';
import { ChartRenderer } from '../charts/ChartRenderer';

interface MainPanelRegionProps {
  spec: MainPanelRegionType;
  charts?: Record<string, ChartSpec>;
}

export const MainPanelRegion: React.FC<MainPanelRegionProps> = ({
  spec,
  charts,
}) => {
  const { grid_config, charts: chartRefs } = spec;
  const columns = grid_config.columns;
  const gap = grid_config.gap || '16px';
  const rows = grid_config.rows === 'auto' ? undefined : grid_config.rows;

  // Вычисляем grid-template-rows если rows не 'auto'
  const gridTemplateRows =
    rows !== undefined ? `repeat(${rows}, minmax(200px, 1fr))` : undefined;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows,
        gap,
        padding: '16px',
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        overflow: 'auto',
      }}
    >
      {chartRefs.map((chartRef) => {
        const chartSpec = charts?.[chartRef.chart_id];

        // Если ChartSpec не найден, показываем placeholder
        if (!chartSpec) {
          return (
            <ChartPlaceholder
              key={chartRef.chart_id}
              chartId={chartRef.chart_id}
              span={chartRef.span}
            />
          );
        }

        // Stage 7.7: Получаем все chart_id для синхронизации
        const allChartIds = chartRefs.map((ref) => ref.chart_id);

        // Рендерим ChartRenderer с ChartSpec
        return (
          <div
            key={chartRef.chart_id}
            style={{
              gridColumn: `span ${chartRef.span[0]}`,
              gridRow: `span ${chartRef.span[1]}`,
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              backgroundColor: '#fff',
              minHeight: '200px',
              overflow: 'hidden',
            }}
          >
            <ChartRenderer chartSpec={chartSpec} allChartIds={allChartIds} />
          </div>
        );
      })}
    </div>
  );
};

interface ChartPlaceholderProps {
  chartId: string;
  span: [number, number];
}

const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({
  chartId,
  span,
}) => {
  const [colSpan, rowSpan] = span;

  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
        border: '2px dashed #999',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        color: '#666',
      }}
    >
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        Chart Placeholder
      </div>
      <div style={{ fontSize: '14px', color: '#999' }}>ID: {chartId}</div>
      <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
        Span: {colSpan}×{rowSpan}
      </div>
    </div>
  );
};
