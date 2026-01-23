/**
 * TooltipLayer - компонент для отображения tooltip при hover на графиках
 * Stage 7.2: Hover & Tooltip Layer
 * 
 * Подписывается на hover_state из shared_state
 * Позиционируется относительно курсора
 * Отображает данные из hover_state (x, y, series, event info)
 */

import React from 'react';
import { useSharedStateField } from '../../context/SharedStateContext';
import type { HoverState } from '../../context/SharedStateContext';

interface TooltipLayerProps {
  /**
   * Контейнер графика для позиционирования tooltip относительно него
   */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * TooltipLayer рендерит tooltip поверх графика
 * Подписывается на hover_state из shared_state
 * Не отображается при hover_state === null
 */
export const TooltipLayer: React.FC<TooltipLayerProps> = ({ containerRef }) => {
  const [hoverState] = useSharedStateField('hover_state');

  // Если нет hover_state, не рендерим tooltip
  if (!hoverState || !containerRef.current) {
    return null;
  }

  // Получаем позицию курсора относительно контейнера
  const container = containerRef.current;
  const containerRect = container.getBoundingClientRect();

  // Извлекаем координаты мыши из hover_state.data
  const data = hoverState.data as { mouseX?: number; mouseY?: number } | undefined;
  const mouseX = data?.mouseX ?? containerRect.width / 2;
  const mouseY = data?.mouseY ?? containerRect.height / 2;

  // Позиционируем tooltip рядом с курсором
  // Смещаем tooltip вправо и вверх от курсора
  const offsetX = 10;
  const offsetY = -10;

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    left: `${mouseX + offsetX}px`,
    top: `${mouseY + offsetY}px`,
    transform: 'translateY(-100%)', // Поднимаем tooltip над курсором
  };

  // Форматируем данные для отображения
  const formatValue = (value: number): string => {
    if (Math.abs(value) < 0.01 || Math.abs(value) > 1000000) {
      return value.toExponential(3);
    }
    return value.toFixed(3);
  };

  // Извлекаем информацию из hover_state
  const x = hoverState.x;
  const y = hoverState.y;
  const chartId = hoverState.chart_id;
  const data = hoverState.data;

  // Формируем содержимое tooltip
  const tooltipContent: React.ReactNode[] = [];

  // Добавляем chart_id
  tooltipContent.push(
    <div key="chart-id" style={{ fontWeight: 'bold', marginBottom: '4px' }}>
      {chartId}
    </div>
  );

  // Добавляем координаты
  tooltipContent.push(
    <div key="coords" style={{ marginBottom: '4px' }}>
      <div>X: {formatValue(x)}</div>
      <div>Y: {formatValue(y)}</div>
    </div>
  );

  // Если есть дополнительные данные, отображаем их
  if (data && typeof data === 'object') {
    const dataObj = data as Record<string, unknown>;
    
    // Если есть series информация
    if (dataObj.series) {
      tooltipContent.push(
        <div key="series" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.3)' }}>
          Series: {String(dataObj.series)}
        </div>
      );
    }

    // Если есть event информация
    if (dataObj.event) {
      const event = dataObj.event as Record<string, unknown>;
      if (event.type) {
        tooltipContent.push(
          <div key="event-type" style={{ marginTop: '4px' }}>
            Type: {String(event.type)}
          </div>
        );
      }
      if (event.channel) {
        tooltipContent.push(
          <div key="event-channel">
            Channel: {String(event.channel)}
          </div>
        );
      }
      if (event.frameIndex !== undefined) {
        tooltipContent.push(
          <div key="event-frame">
            Frame: {String(event.frameIndex)}
          </div>
        );
      }
    }

    // Если есть дополнительные поля
    const otherFields = Object.keys(dataObj).filter(
      (key) => !['series', 'event'].includes(key)
    );
    if (otherFields.length > 0) {
      tooltipContent.push(
        <div key="other" style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.3)' }}>
          {otherFields.map((key) => (
            <div key={key}>
              {key}: {String(dataObj[key])}
            </div>
          ))}
        </div>
      );
    }
  }

  return (
    <div style={tooltipStyle}>
      {tooltipContent}
    </div>
  );
};
