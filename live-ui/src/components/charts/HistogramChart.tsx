/**
 * HistogramChart - компонент для визуализации гистограмм
 * Stage 5: только визуализация через Observable Plot, без интерактивности
 */

import React, { useMemo } from 'react';
import * as Plot from '@observablehq/plot';
import type { ChartSpec } from '../../types';
import type { Series } from '../../data/types';

interface HistogramChartProps {
  chartSpec: ChartSpec;
  series: Series[];
  isLoading: boolean;
}

/**
 * HistogramChart рендерит гистограмму через Observable Plot
 * Bins рассчитываются из данных автоматически
 * Window применяется на уровне data-layer
 */
export const HistogramChart: React.FC<HistogramChartProps> = ({
  chartSpec,
  series,
  isLoading,
}) => {
  // Преобразуем Series[] в массив объектов для гистограммы
  const plotData = useMemo(() => {
    if (series.length === 0) {
      return [];
    }

    // Объединяем все точки из всех series в массив объектов
    return series.flatMap((s) =>
      s.points.map((point) => ({
        value: point.y,
      }))
    );
  }, [series]);

  // Определяем цвет из visual.fill или используем дефолтный
  const fill = chartSpec.visual?.fill || '#1f77b4';
  const stroke = chartSpec.visual?.stroke || '#1f77b4';
  const strokeWidth = chartSpec.visual?.strokeWidth || 1;
  const opacity = chartSpec.visual?.opacity ?? 0.7;

  // Определяем scale для Y оси (X - это bins, всегда linear)
  const yScale = chartSpec.mappings?.y?.scale || 'linear';

  // Определяем labels для осей
  const xLabel = chartSpec.axes?.x?.label || 'Value';
  const yLabel = chartSpec.axes?.y?.label || 'Frequency';

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
        label: xLabel,
        grid: xGrid,
      },
      y: {
        type: yScale,
        label: yLabel,
        grid: yGrid,
      },
    };

    // Histogram использует rectY mark с binX для группировки
    baseOptions.marks = [
      Plot.rectY(plotData, {
        x: Plot.binX({ y: 'count' }, { x: 'value' }),
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        fillOpacity: opacity,
      }),
    ];

    return baseOptions;
  }, [
    plotData,
    fill,
    stroke,
    strokeWidth,
    opacity,
    yScale,
    xLabel,
    yLabel,
    xGrid,
    yGrid,
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
