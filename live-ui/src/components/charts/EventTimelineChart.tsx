/**
 * EventTimelineChart - компонент для визуализации дискретных событий на временной оси
 * Stage 6: кастомный рендеринг через D3, без интерактивности
 */

import React, { useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { ChartSpec } from '../../types';
import type { Series, Event } from '../../data/types';

interface EventTimelineChartProps {
  chartSpec: ChartSpec;
  series: Series[];
  isLoading: boolean;
}

/**
 * EventTimelineChart рендерит события как маркеры на временной оси
 * X-ось: frameIndex или simTime
 * Y-ось: категориальная (по type или channel) или фиксированная линия
 * Color: по channel или type
 * Shape: по type (если указано)
 */
export const EventTimelineChart: React.FC<EventTimelineChartProps> = ({
  chartSpec,
  series,
  isLoading,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Извлекаем все события из series
  const events = useMemo(() => {
    const allEvents: Array<{ event: Event; point: { x: number; y: number } }> = [];
    for (const s of series) {
      for (const point of s.points) {
        allEvents.push({ event: point.event, point });
      }
    }
    return allEvents;
  }, [series]);

  // Определяем X-поле (frameIndex или simTime)
  const xField = chartSpec.mappings?.x?.field || 'frameIndex';
  const xScaleType = chartSpec.mappings?.x?.scale || 'linear';

  // Определяем Y-поле (категориальное: type, channel, или фиксированная линия)
  const yField = chartSpec.mappings?.y?.field;
  const isCategoricalY = yField === 'type' || yField === 'channel';

  // Определяем color mapping
  const colorField = chartSpec.mappings?.color?.field;
  const colorScaleType = chartSpec.mappings?.color?.scale || 'ordinal';
  const colorPalette = chartSpec.mappings?.color?.palette;

  // Определяем shape mapping
  const shapeField = chartSpec.mappings?.shape?.field;
  const shapeMapping = chartSpec.mappings?.shape?.mapping;

  // Определяем size mapping
  const sizeField = chartSpec.mappings?.size?.field;
  const sizeRange = chartSpec.mappings?.size?.range || [4, 8];

  // Визуальные параметры
  const stroke = chartSpec.visual?.stroke || '#1f77b4';
  const fill = chartSpec.visual?.fill || stroke;
  const strokeWidth = chartSpec.visual?.strokeWidth || 1;
  const opacity = chartSpec.visual?.opacity ?? 0.8;

  // Labels для осей
  const xLabel = chartSpec.axes?.x?.label || '';
  const yLabel = chartSpec.axes?.y?.label || '';
  const showXGrid = chartSpec.axes?.x?.grid ?? true;
  const showYGrid = chartSpec.axes?.y?.grid ?? true;

  // Рендеринг через D3
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || isLoading || events.length === 0) {
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Очищаем предыдущий рендер

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 40;
    const marginLeft = 80;

    const innerWidth = width - marginLeft - marginRight;
    const innerHeight = height - marginTop - marginBottom;

    // Извлекаем X-значения
    const xValues = events.map((e) => {
      if (xField === 'frameIndex') {
        return e.event.frameIndex;
      } else if (xField === 'simTime') {
        return e.event.simTime;
      } else {
        return e.point.x;
      }
    });

    // Определяем Y-категории
    let yCategories: string[] = [];
    if (isCategoricalY) {
      const categorySet = new Set<string>();
      for (const e of events) {
        if (yField === 'type') {
          categorySet.add(e.event.type);
        } else if (yField === 'channel') {
          categorySet.add(e.event.channel);
        }
      }
      yCategories = Array.from(categorySet).sort();
    }

    // Создаём X scale
    const xDomain: [number, number] = [
      Math.min(...xValues),
      Math.max(...xValues),
    ];
    const xScale =
      xScaleType === 'log'
        ? d3.scaleLog().domain(xDomain).range([0, innerWidth])
        : d3.scaleLinear().domain(xDomain).range([0, innerWidth]);

    // Создаём Y scale
    const yScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number> = isCategoricalY
      ? d3
          .scaleBand()
          .domain(yCategories)
          .range([innerHeight, 0])
          .padding(0.2)
      : d3.scaleLinear().domain([0, 1]).range([innerHeight, 0]);

    // Создаём color scale (для event_timeline используется только ordinal)
    let colorScale: d3.ScaleOrdinal<string, string> | null = null;
    if (colorField && colorScaleType === 'ordinal') {
      const colorValues = new Set<string>();
      for (const e of events) {
        if (colorField === 'type') {
          colorValues.add(e.event.type);
        } else if (colorField === 'channel') {
          colorValues.add(e.event.channel);
        }
      }
      const colorDomain = Array.from(colorValues);
      colorScale = d3
        .scaleOrdinal<string>()
        .domain(colorDomain)
        .range(
          colorPalette ||
            d3.schemeCategory10.slice(0, colorDomain.length)
        );
    }

    // Создаём size scale (если указано)
    let sizeScale: d3.ScaleLinear<number, number> | null = null;
    if (sizeField && sizeField.startsWith('payload.')) {
      const sizeValues: number[] = [];
      for (const e of events) {
        const path = sizeField.substring('payload.'.length);
        const parts = path.split('.');
        let value: unknown = e.event.payload;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part];
          } else {
            value = null;
            break;
          }
        }
        if (typeof value === 'number') {
          sizeValues.push(value);
        }
      }
      if (sizeValues.length > 0) {
        const sizeDomain: [number, number] = [
          Math.min(...sizeValues),
          Math.max(...sizeValues),
        ];
        sizeScale = d3
          .scaleLinear()
          .domain(sizeDomain)
          .range(sizeRange);
      }
    }

    // Создаём основной group для графика
    const g = svg
      .append('g')
      .attr('transform', `translate(${marginLeft},${marginTop})`);

    // Рисуем grid для X-оси
    if (showXGrid) {
      const xTicks = xScale.ticks(10);
      g.selectAll('.x-grid-line')
        .data(xTicks)
        .enter()
        .append('line')
        .attr('class', 'x-grid-line')
        .attr('x1', (d: number) => xScale(d) || 0)
        .attr('x2', (d: number) => xScale(d) || 0)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);
    }

    // Рисуем grid для Y-оси
    if (showYGrid && isCategoricalY) {
      const yBandScale = yScale as d3.ScaleBand<string>;
      g.selectAll('.y-grid-line')
        .data(yCategories)
        .enter()
        .append('line')
        .attr('class', 'y-grid-line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d: string) => {
          const yPos = yBandScale(d);
          return (yPos !== undefined ? yPos : 0) + yBandScale.bandwidth() / 2;
        })
        .attr('y2', (d: string) => {
          const yPos = yBandScale(d);
          return (yPos !== undefined ? yPos : 0) + yBandScale.bandwidth() / 2;
        })
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 1)
        .attr('opacity', 0.5);
    }

    // Рисуем события как маркеры
    const markers = g
      .selectAll('.event-marker')
      .data(events)
      .enter()
      .append('g')
      .attr('class', 'event-marker')
      .attr(
        'transform',
        (d: { event: Event; point: { x: number; y: number } }) => {
          const x = xField === 'frameIndex' 
            ? d.event.frameIndex 
            : xField === 'simTime' 
            ? d.event.simTime 
            : d.point.x;
          let y: number;
          if (isCategoricalY) {
            const yBandScale = yScale as d3.ScaleBand<string>;
            const category = yField === 'type' ? d.event.type : yField === 'channel' ? d.event.channel : '';
            const yPos = yBandScale(category);
            y = (yPos !== undefined ? yPos : innerHeight / 2) + yBandScale.bandwidth() / 2;
          } else {
            y = innerHeight / 2;
          }
          return `translate(${xScale(x)},${y})`;
        }
      );

    // Определяем цвет для маркера
    const getColor = (event: Event): string => {
      if (colorScale && colorField) {
        if (colorField === 'type') {
          return colorScale(event.type) || fill;
        } else if (colorField === 'channel') {
          return colorScale(event.channel) || fill;
        }
      }
      return fill;
    };

    // Определяем размер маркера
    const getSize = (event: Event): number => {
      if (sizeScale && sizeField && sizeField.startsWith('payload.')) {
        const path = sizeField.substring('payload.'.length);
        const parts = path.split('.');
        let value: unknown = event.payload;
        for (const part of parts) {
          if (value && typeof value === 'object') {
            value = (value as Record<string, unknown>)[part];
          } else {
            return sizeRange[0];
          }
        }
        if (typeof value === 'number') {
          return sizeScale(value);
        }
      }
      return sizeRange[0];
    };

    // Определяем форму маркера
    const getShape = (event: Event): string => {
      if (shapeField === 'type' && shapeMapping) {
        return shapeMapping[event.type] || 'circle';
      }
      return 'circle';
    };

    // Рисуем маркеры
    markers.each(function (this: SVGGElement, d: { event: Event; point: { x: number; y: number } }) {
      const marker = d3.select(this);
      const color = getColor(d.event);
      const size = getSize(d.event);
      const shape = getShape(d.event);

      if (shape === 'circle') {
        marker
          .append('circle')
          .attr('r', size)
          .attr('fill', color)
          .attr('stroke', stroke)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', opacity);
      } else if (shape === 'square') {
        marker
          .append('rect')
          .attr('x', -size)
          .attr('y', -size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('fill', color)
          .attr('stroke', stroke)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', opacity);
      } else if (shape === 'triangle') {
        const path = d3.path();
        path.moveTo(0, -size);
        path.lineTo(-size, size);
        path.lineTo(size, size);
        path.closePath();
        marker
          .append('path')
          .attr('d', path.toString())
          .attr('fill', color)
          .attr('stroke', stroke)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', opacity);
      } else {
        // По умолчанию circle
        marker
          .append('circle')
          .attr('r', size)
          .attr('fill', color)
          .attr('stroke', stroke)
          .attr('stroke-width', strokeWidth)
          .attr('opacity', opacity);
      }
    });

    // Рисуем X-ось
    const xAxis = d3.axisBottom(xScale);
    if (xScaleType === 'log') {
      xAxis.tickFormat(d3.format('.2e'));
    }
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    // Добавляем label для X-оси
    if (xLabel) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + marginBottom - 5)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(xLabel);
    }

    // Рисуем Y-ось
    if (isCategoricalY) {
      const yBandScale = yScale as d3.ScaleBand<string>;
      const yAxis = d3.axisLeft(yBandScale);
      g.append('g').call(yAxis);
    } else {
      const yLinearScale = yScale as d3.ScaleLinear<number, number>;
      const yAxis = d3.axisLeft(yLinearScale);
      g.append('g').call(yAxis);
    }

    // Добавляем label для Y-оси
    if (yLabel) {
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -marginLeft + 15)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(yLabel);
    }
  }, [
    events,
    isLoading,
    chartSpec,
    xField,
    xScaleType,
    yField,
    isCategoricalY,
    colorField,
    colorScaleType,
    colorPalette,
    shapeField,
    shapeMapping,
    sizeField,
    sizeRange,
    stroke,
    fill,
    strokeWidth,
    opacity,
    xLabel,
    yLabel,
    showXGrid,
    showYGrid,
  ]);

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

  if (events.length === 0) {
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
      <svg
        ref={svgRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
