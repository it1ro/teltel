/**
 * useTimeCursorInteraction - hook для обработки интерактивного управления time_cursor
 * Stage 7.3: Time Cursor Interaction
 * 
 * Обрабатывает click и drag события на графиках
 * Преобразует координаты мыши в значения оси (frameIndex/simTime)
 * Обновляет time_cursor.value через shared_state
 * 
 * Hook не знает про визуализацию
 * Hook не хранит состояние
 * Hook работает с scale, переданным графиком
 */

import { useCallback, useRef } from 'react';
import { useSharedState } from '../context/SharedStateContext';
import type { Series } from '../data/types';
import type { ChartSpec } from '../types';

interface TimeCursorInteractionOptions {
  /**
   * ChartSpec графика (для получения chart_id и mappings)
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
 * useTimeCursorInteraction возвращает обработчики событий для управления time_cursor
 * 
 * @returns объект с обработчиками onClick, onMouseDown, onMouseMove, onMouseUp
 */
export const useTimeCursorInteraction = ({
  chartSpec: _chartSpec,
  series,
  containerRef,
}: TimeCursorInteractionOptions) => {
  const { sharedState, updateTimeCursor, updateLiveMode } = useSharedState();
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const pauseOnDragRef = useRef(false);

  /**
   * Преобразует координаты мыши в значение оси (frameIndex или simTime)
   * Использует данные графика для вычисления scale
   */
  const mouseToAxisValue = useCallback(
    (mouseX: number, containerRect: DOMRect): number | null => {
      if (series.length === 0) {
        return null;
      }

      // Получаем axis из shared_state
      const axis = sharedState.time_cursor?.axis || 'frameIndex';

      // Извлекаем X-значения из данных
      const xValues: number[] = [];
      for (const s of series) {
        for (const point of s.points) {
          // Используем frameIndex или simTime в зависимости от axis
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
        return xMin;
      }

      // Определяем margins (соответствуют Observable Plot defaults)
      const marginLeft = 60;
      const marginRight = 20;
      // marginTop и marginBottom не используются в этой функции, но оставляем для консистентности
      // const marginTop = 20;
      // const marginBottom = 40;
      const innerWidth = containerRect.width - marginLeft - marginRight;

      // Преобразуем координаты мыши в координаты данных
      const xScale = (mouseX - marginLeft) / innerWidth;
      const clampedXScale = Math.max(0, Math.min(1, xScale));

      // Вычисляем значение оси
      const axisValue = xMin + clampedXScale * (xMax - xMin);

      return axisValue;
    },
    [series, sharedState.time_cursor?.axis]
  );

  /**
   * Обработчик click
   * Устанавливает time_cursor.value
   */
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Игнорируем click, если это был drag
      if (isDraggingRef.current) {
        return;
      }

      if (!containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Координаты мыши относительно контейнера
      const mouseX = event.clientX - containerRect.left;

      // Преобразуем в значение оси
      const axisValue = mouseToAxisValue(mouseX, containerRect);

      if (axisValue !== null) {
        // Stage 7.5: При ручном изменении time_cursor ставим на pause, если играет
        if (sharedState.live_mode?.is_playing) {
          updateLiveMode((prev) => ({
            ...prev,
            is_playing: false,
          }));
        }
        // Обновляем time_cursor через shared_state
        updateTimeCursor(axisValue);
      }
    },
    [containerRef, mouseToAxisValue, updateTimeCursor, sharedState.live_mode?.is_playing, updateLiveMode]
  );

  /**
   * Обработчик mousedown
   * Начинает drag
   */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Начинаем drag только при клике на основной кнопке мыши
      if (event.button !== 0) {
        return;
      }

      if (!containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      isDraggingRef.current = true;
      dragStartRef.current = { x: mouseX, y: mouseY };
      
      // Stage 7.5: Запоминаем, нужно ли ставить на pause при начале drag
      pauseOnDragRef.current = sharedState.live_mode?.is_playing ?? false;

      // Устанавливаем начальное значение time_cursor
      const axisValue = mouseToAxisValue(mouseX, containerRect);
      if (axisValue !== null) {
        // Stage 7.5: При ручном изменении time_cursor ставим на pause, если играет
        if (pauseOnDragRef.current) {
          updateLiveMode((prev) => ({
            ...prev,
            is_playing: false,
          }));
          pauseOnDragRef.current = false; // Сбрасываем флаг после первого обновления
        }
        updateTimeCursor(axisValue);
      }

      // Предотвращаем выделение текста при drag
      event.preventDefault();
    },
    [containerRef, mouseToAxisValue, updateTimeCursor, sharedState.live_mode?.is_playing, updateLiveMode]
  );

  /**
   * Обработчик mousemove
   * Обновляет time_cursor.value во время drag
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      const mouseX = event.clientX - containerRect.left;

      // Преобразуем в значение оси
      const axisValue = mouseToAxisValue(mouseX, containerRect);

      if (axisValue !== null) {
        // Stage 7.5: При ручном изменении time_cursor ставим на pause, если играет
        // (только при первом движении, чтобы не ставить на pause при каждом обновлении)
        if (pauseOnDragRef.current) {
          updateLiveMode((prev) => ({
            ...prev,
            is_playing: false,
          }));
          pauseOnDragRef.current = false; // Сбрасываем флаг после первого обновления
        }
        // Обновляем time_cursor в реальном времени
        updateTimeCursor(axisValue);
      }
    },
    [mouseToAxisValue, updateTimeCursor, sharedState.live_mode?.is_playing, updateLiveMode]
  );

  /**
   * Обработчик mouseup
   * Завершает drag
   */
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    pauseOnDragRef.current = false;
  }, []);

  /**
   * Обработчик mouseleave
   * Завершает drag при выходе мыши за пределы графика
   */
  const handleMouseLeave = useCallback(() => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    pauseOnDragRef.current = false;
  }, []);

  return {
    onClick: handleClick,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
  };
};
