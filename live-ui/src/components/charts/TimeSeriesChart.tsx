/**
 * TimeSeriesChart - компонент для визуализации временных рядов
 * Stage 5: только визуализация через Observable Plot, без интерактивности
 */

import React, { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import type { ChartSpec } from '../../types';
import type { Series } from '../../data/types';

interface TimeSeriesChartProps {
  chartSpec: ChartSpec;
  series: Series[];
  isLoading: boolean;
}

/**
 * TimeSeriesChart рендерит временной ряд через Observable Plot
 * Поддерживает line, area, point marks
 * Multi-series поддерживается через несколько series
 */
export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  chartSpec,
  series,
  isLoading,
}) => {
  // Преобразуем Series[] в формат для Observable Plot
  const plotData = useMemo(() => {
    if (series.length === 0) {
      return [];
    }

    // Если несколько series, объединяем их с меткой series id
    if (series.length > 1) {
      return series.flatMap((s) =>
        s.points.map((point) => ({
          x: point.x,
          y: point.y,
          series: s.id,
        }))
      );
    }

    // Одна series - простой массив точек
    return series[0].points.map((point) => ({
      x: point.x,
      y: point.y,
    }));
  }, [series]);

  // Определяем mark type из visual.mark
  const markType = chartSpec.visual?.mark || 'line';

  // Определяем цвет из visual.stroke или используем дефолтный
  const stroke = chartSpec.visual?.stroke || '#1f77b4';
  const fill = chartSpec.visual?.fill || null;
  const strokeWidth = chartSpec.visual?.strokeWidth || 1.5;
  const opacity = chartSpec.visual?.opacity ?? 1;

  // Определяем scale для X и Y осей
  const xScale = chartSpec.mappings?.x?.scale || 'linear';
  const yScale = chartSpec.mappings?.y?.scale || 'linear';

  // Определяем labels для осей
  const xLabel = chartSpec.axes?.x?.label || '';
  const yLabel = chartSpec.axes?.y?.label || '';

  // Определяем, показывать ли grid
  const xGrid = chartSpec.axes?.x?.grid ?? true;
  const yGrid = chartSpec.axes?.y?.grid ?? true;

  // Строим Plot spec
  const plotOptions: Plot.PlotOptions = useMemo(() => {
    const baseOptions: Plot.PlotOptions = {
      marginTop: 20,
      marginRight: 20,
      marginBottom: 40,
      marginLeft: 60,
      x: {
        type: xScale,
        label: xLabel,
        grid: xGrid,
      },
      y: {
        type: yScale,
        label: yLabel,
        grid: yGrid,
      },
      color: series.length > 1 ? { legend: chartSpec.legend?.show ?? true } : undefined,
    };

    // Добавляем mark в зависимости от типа
    if (markType === 'line') {
      baseOptions.marks = [
        Plot.line(plotData, {
          x: 'x',
          y: 'y',
          stroke: series.length > 1 ? 'series' : stroke,
          strokeWidth,
          opacity,
        }),
      ];
    } else if (markType === 'area') {
      baseOptions.marks = [
        Plot.areaY(plotData, {
          x: 'x',
          y: 'y',
          fill: fill || stroke,
          fillOpacity: opacity,
          stroke: stroke,
          strokeWidth,
        }),
      ];
    } else if (markType === 'point') {
      baseOptions.marks = [
        Plot.dot(plotData, {
          x: 'x',
          y: 'y',
          fill: series.length > 1 ? 'series' : stroke,
          stroke: stroke,
          strokeWidth,
          opacity,
        }),
      ];
    }

    return baseOptions;
  }, [
    plotData,
    markType,
    stroke,
    fill,
    strokeWidth,
    opacity,
    xScale,
    yScale,
    xLabel,
    yLabel,
    xGrid,
    yGrid,
    series.length,
    chartSpec.legend?.show,
  ]);

  // Рендерим график
  const plotRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!plotRef.current || isLoading || plotData.length === 0) {
      return;
    }

    // Очищаем предыдущий график
    plotRef.current.innerHTML = '';

    // Создаём новый график
    const plotElement = Plot.plot(plotOptions);
    plotRef.current.appendChild(plotElement);
  }, [plotOptions, isLoading, plotData.length]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#666',
        }}
      >
        Загрузка данных...
      </div>
    );
  }

  if (plotData.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
        }}
      >
        Нет данных для отображения
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
      }}
    >
      {chartSpec.title && (
        <div
          style={{
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          {chartSpec.title}
        </div>
      )}
      <div
        ref={plotRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      />
    </div>
  );
};
