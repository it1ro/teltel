/**
 * useHoverInteraction - hook для обработки hover-интерактивности на графиках
 * Stage 7.2: Hover & Tooltip Layer
 * 
 * Обрабатывает mouse events (mousemove, mouseleave)
 * Вычисляет ближайшую точку данных
 * Обновляет hover_state через shared_state
 * 
 * Hook не знает про Tooltip
 * Hook не хранит состояние
 * Hook работает с данными, переданными графиком
 */

import { useCallback, useRef } from 'react';
import { useSharedState } from '../context/SharedStateContext';
import type { Series, DataPoint } from '../data/types';
import type { ChartSpec } from '../types';

interface HoverInteractionOptions {
  /**
   * ChartSpec графика (для получения chart_id)
   */
  chartSpec: ChartSpec;
  /**
   * Данные графика (Series[])
   */
  series: Series[];
  /**
   * Контейнер графика для получения координат мыши
   */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * useHoverInteraction возвращает обработчики событий для hover
 * 
 * @returns объект с обработчиками onMouseMove и onMouseLeave
 */
export const useHoverInteraction = ({
  chartSpec,
  series,
  containerRef,
}: HoverInteractionOptions) => {
  const { updateHoverState } = useSharedState();
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Вычисляет ближайшую точку данных к позиции мыши
   * Для time_series и scatter: ищет ближайшую точку по евклидову расстоянию
   * Для histogram: ищет ближайший bin
   * Для event_timeline: ищет ближайшее событие
   */
  const findNearestPoint = useCallback(
    (
      mouseX: number,
      mouseY: number,
      containerRect: DOMRect
    ): { point: DataPoint; seriesId: string; distance: number } | null => {
      if (series.length === 0) {
        return null;
      }

      // Преобразуем координаты мыши в координаты данных
      // Для этого нужно знать масштаб графика
      // Пока используем простую эвристику: ищем ближайшую точку по экранным координатам
      
      let nearest: { point: DataPoint; seriesId: string; distance: number } | null = null;
      const threshold = 50; // Максимальное расстояние в пикселях

      for (const s of series) {
        for (const point of s.points) {
          // Приблизительное преобразование координат данных в экранные
          // Это упрощённая версия, в реальности нужно использовать scale из графика
          // Для Stage 7.2 используем простую эвристику
          const dataX = point.x;
          const dataY = point.y;

          // Нормализуем координаты данных относительно диапазона
          const xRange = series.flatMap((s) => s.points.map((p) => p.x));
          const yRange = series.flatMap((s) => s.points.map((p) => p.y));
          const xMin = Math.min(...xRange);
          const xMax = Math.max(...xRange);
          const yMin = Math.min(...yRange);
          const yMax = Math.max(...yRange);

          const xScale = (dataX - xMin) / (xMax - xMin || 1);
          const yScale = (dataY - yMin) / (yMax - yMin || 1);

          // Преобразуем в экранные координаты (учитывая margins)
          const marginLeft = 60;
          const marginRight = 20;
          const marginTop = 20;
          const marginBottom = 40;
          const innerWidth = containerRect.width - marginLeft - marginRight;
          const innerHeight = containerRect.height - marginTop - marginBottom;

          const screenX = marginLeft + xScale * innerWidth;
          const screenY = marginTop + (1 - yScale) * innerHeight; // Y инвертирован

          // Вычисляем расстояние
          const dx = mouseX - screenX;
          const dy = mouseY - screenY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < threshold) {
            if (!nearest || distance < nearest.distance) {
              nearest = { point, seriesId: s.id, distance };
            }
          }
        }
      }

      return nearest;
    },
    [series]
  );

  /**
   * Обработчик mousemove
   * Вычисляет ближайшую точку и обновляет hover_state
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Координаты мыши относительно контейнера
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      // Сохраняем позицию мыши для tooltip
      mousePositionRef.current = { x: mouseX, y: mouseY };

      // Ищем ближайшую точку данных
      const nearest = findNearestPoint(mouseX, mouseY, containerRect);

      if (nearest) {
        // Обновляем hover_state через shared_state
        updateHoverState({
          chart_id: chartSpec.chart_id,
          x: nearest.point.x,
          y: nearest.point.y,
          data: {
            series: nearest.seriesId,
            event: nearest.point.event,
            mouseX,
            mouseY,
          },
        });
      } else {
        // Если нет ближайшей точки, но мышь над графиком, показываем координаты мыши
        // Преобразуем экранные координаты в координаты данных
        const xRange = series.flatMap((s) => s.points.map((p) => p.x));
        const yRange = series.flatMap((s) => s.points.map((p) => p.y));
        const xMin = Math.min(...xRange);
        const xMax = Math.max(...xRange);
        const yMin = Math.min(...yRange);
        const yMax = Math.max(...yRange);

        const marginLeft = 60;
        const marginRight = 20;
        const marginTop = 20;
        const marginBottom = 40;
        const innerWidth = containerRect.width - marginLeft - marginRight;
        const innerHeight = containerRect.height - marginTop - marginBottom;

        const xScale = (mouseX - marginLeft) / innerWidth;
        const yScale = 1 - (mouseY - marginTop) / innerHeight;

        const dataX = xMin + xScale * (xMax - xMin);
        const dataY = yMin + yScale * (yMax - yMin);

        updateHoverState({
          chart_id: chartSpec.chart_id,
          x: dataX,
          y: dataY,
          data: {
            mouseX,
            mouseY,
          },
        });
      }
    },
    [chartSpec, series, containerRef, findNearestPoint, updateHoverState]
  );

  /**
   * Обработчик mouseleave
   * Сбрасывает hover_state
   */
  const handleMouseLeave = useCallback(() => {
    updateHoverState(null);
    mousePositionRef.current = null;
  }, [updateHoverState]);

  return {
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };
};
