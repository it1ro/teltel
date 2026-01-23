/**
 * MainPanelRegion - компонент для отображения main panel региона
 * Рендерит grid layout с заглушками графиков
 */

import React from 'react';
import type { MainPanelRegion as MainPanelRegionType } from '../../types';

interface MainPanelRegionProps {
  spec: MainPanelRegionType;
}

export const MainPanelRegion: React.FC<MainPanelRegionProps> = ({ spec }) => {
  const { grid_config, charts } = spec;
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
      {charts.map((chart) => (
        <ChartPlaceholder
          key={chart.chart_id}
          chartId={chart.chart_id}
          span={chart.span}
        />
      ))}
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
