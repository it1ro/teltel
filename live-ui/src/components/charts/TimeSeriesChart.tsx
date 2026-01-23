/**
 * TimeSeriesChart - компонент для визуализации временных рядов
 * Stage 5: только визуализация через Observable Plot, без интерактивности
 * Stage 7.2: добавлена hover-интерактивность через shared_state
 * Stage 7.3: добавлена интерактивность time_cursor через shared_state
 */

import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as Plot from '@observablehq/plot';
import type { ChartSpec } from '../../types';
import type { Series } from '../../data/types';
import { useHoverInteraction } from '../../hooks/useHoverInteraction';
import { useTimeCursorInteraction } from '../../hooks/useTimeCursorInteraction';
import { useSharedStateField } from '../../context/SharedStateContext';
import { TooltipLayer } from '../interaction/TooltipLayer';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorOverlayRef = useRef<SVGSVGElement>(null);

  // Stage 7.2: hover-интерактивность через shared_state
  const { onMouseMove, onMouseLeave } = useHoverInteraction({
    chartSpec,
    series,
    containerRef,
  });

  // Stage 7.3: time cursor интерактивность через shared_state
  const timeCursorHandlers = useTimeCursorInteraction({
    chartSpec,
    series,
    containerRef,
  });

  // Подписка на time_cursor из shared_state
  const [timeCursor] = useSharedStateField('time_cursor');

  // Вычисляем позицию time cursor для визуализации
  const cursorPosition = useMemo(() => {
    if (!timeCursor?.value || series.length === 0) {
      return null;
    }

    const axis = timeCursor.axis || 'frameIndex';
    
    // Извлекаем X-значения из данных
    const xValues: number[] = [];
    for (const s of series) {
      for (const point of s.points) {
        if (axis === 'frameIndex') {
          xValues.push(point.frameIndex);
        } else {
          xValues.push(point.simTime);
        }
      }
    }

    if (xValues.length === 0) {
      return null;
    }

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);

    if (xMin === xMax) {
      return null;
    }

    // Вычисляем позицию курсора в диапазоне [0, 1]
    const cursorValue = timeCursor.value;
    const position = (cursorValue - xMin) / (xMax - xMin);

    return Math.max(0, Math.min(1, position));
  }, [timeCursor, series]);

  // Отрисовка time cursor (вертикальная линия)
  useEffect(() => {
    if (!cursorOverlayRef.current || !plotRef.current || cursorPosition === null) {
      if (cursorOverlayRef.current) {
        cursorOverlayRef.current.style.display = 'none';
      }
      return;
    }

    const plotElement = plotRef.current.querySelector('svg');
    if (!plotElement) {
      return;
    }

    const plotRect = plotElement.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) {
      return;
    }

    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const innerWidth = plotRect.width - marginLeft - marginRight;
    const innerHeight = plotRect.height - marginTop - marginBottom;

    const cursorX = marginLeft + cursorPosition * innerWidth;

    const svg = cursorOverlayRef.current;
    svg.style.display = 'block';
    svg.setAttribute('width', String(plotRect.width));
    svg.setAttribute('height', String(plotRect.height));
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';

    // Очищаем предыдущую линию
    svg.innerHTML = '';

    // Рисуем вертикальную линию
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(cursorX));
    line.setAttribute('y1', String(marginTop));
    line.setAttribute('x2', String(cursorX));
    line.setAttribute('y2', String(plotRect.height - marginBottom));
    line.setAttribute('stroke', '#ff6b6b');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '4,4');
    line.setAttribute('opacity', '0.8');
    svg.appendChild(line);
  }, [cursorPosition]);

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
      ref={containerRef}
      onMouseMove={(e) => {
        onMouseMove(e);
        timeCursorHandlers.onMouseMove(e);
      }}
      onMouseLeave={(e) => {
        onMouseLeave();
        timeCursorHandlers.onMouseLeave();
      }}
      onClick={timeCursorHandlers.onClick}
      onMouseDown={timeCursorHandlers.onMouseDown}
      onMouseUp={timeCursorHandlers.onMouseUp}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        position: 'relative',
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
          position: 'relative',
        }}
      >
        <svg
          ref={cursorOverlayRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: 'none',
          }}
        />
      </div>
      <TooltipLayer containerRef={containerRef} />
    </div>
  );
};
