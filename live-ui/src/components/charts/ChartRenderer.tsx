/**
 * ChartRenderer - главный компонент для рендеринга графиков
 * Принимает ChartSpec и делегирует рендер соответствующему компоненту
 * Stage 5: только визуализация, без интерактивности
 */

import React from 'react';
import type { ChartSpec } from '../../types';
import { TimeSeriesChart } from './TimeSeriesChart';
import { ScatterChart } from './ScatterChart';
import { HistogramChart } from './HistogramChart';
import { useChartData } from '../../hooks/useChartData';
import { useDataLayerContext } from '../../context/DataLayerContext';

interface ChartRendererProps {
  chartSpec: ChartSpec;
}

/**
 * ChartRenderer определяет тип графика и делегирует рендер соответствующему компоненту
 * Не содержит логики визуализации
 */
export const ChartRenderer: React.FC<ChartRendererProps> = ({ chartSpec }) => {
  // Получаем Data Layer из контекста
  const dataLayer = useDataLayerContext();

  // Получаем данные через useChartData
  const { series, isLoading, error } = useChartData(chartSpec, dataLayer);

  // Обработка ошибок
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#d32f2f',
          padding: '16px',
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            Ошибка загрузки данных
          </div>
          <div style={{ fontSize: '14px' }}>{error.message}</div>
        </div>
      </div>
    );
  }

  // Определяем тип графика и делегируем рендер
  switch (chartSpec.type) {
    case 'time_series':
      return (
        <TimeSeriesChart
          chartSpec={chartSpec}
          series={series}
          isLoading={isLoading}
        />
      );

    case 'scatter':
      return (
        <ScatterChart
          chartSpec={chartSpec}
          series={series}
          isLoading={isLoading}
        />
      );

    case 'histogram':
      return (
        <HistogramChart
          chartSpec={chartSpec}
          series={series}
          isLoading={isLoading}
        />
      );

    // Неподдерживаемые типы для Stage 5
    case 'multi_axis_time_series':
    case 'event_timeline':
    case 'run_overview':
    case 'run_comparison':
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#d32f2f',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              Chart type not supported in Stage 5
            </div>
            <div style={{ fontSize: '14px' }}>
              Type: {chartSpec.type}
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#d32f2f',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
              Unknown chart type
            </div>
            <div style={{ fontSize: '14px' }}>
              Type: {String(chartSpec.type)}
            </div>
          </div>
        </div>
      );
  }
};
