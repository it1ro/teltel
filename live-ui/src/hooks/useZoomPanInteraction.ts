/**
 * useZoomPanInteraction - hook для обработки zoom и pan интерактивности на графиках
 * Stage 7.4: Zoom & Pan
 * Stage 7.7: Синхронизация zoom/pan между графиками
 * 
 * Обрабатывает wheel events → zoom по X (и Y, если применимо)
 * Обрабатывает drag (без click на данных) → pan
 * Обновляет interaction_state.zoom и interaction_state.pan через shared_state
 * 
 * Hook не знает про визуализацию
 * Hook не хранит состояние
 * Hook работает с данными графика для вычисления domain
 */

import { useCallback, useRef } from 'react';
import { useSharedState, useSharedStateField } from '../context/SharedStateContext';
import type { Series } from '../data/types';
import type { ChartSpec } from '../types';

interface ZoomPanInteractionOptions {
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
  /**
   * Флаг, указывающий, что drag используется для time_cursor (не для pan)
   */
  isTimeCursorDragging?: boolean;
  /**
   * Stage 7.7: Синхронизируется ли zoom/pan с другими графиками
   */
  syncZoomPan?: boolean;
}

/**
 * useZoomPanInteraction возвращает обработчики событий для zoom и pan
 * 
 * @returns объект с обработчиками onWheel, onMouseDown, onMouseMove, onMouseUp
 */
export const useZoomPanInteraction = ({
  chartSpec: _chartSpec,
  series,
  containerRef,
  isTimeCursorDragging = false,
  syncZoomPan: _syncZoomPan = false,
}: ZoomPanInteractionOptions) => {
  const { updateInteractionState } = useSharedState();
  const [interactionState] = useSharedStateField('interaction_state');
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; domainX: [number, number]; domainY: [number, number] } | null>(null);

  /**
   * Вычисляет текущий domain из данных или из interaction_state
   */
  const getCurrentDomain = useCallback((): { x: [number, number] | null; y: [number, number] | null } => {
    if (series.length === 0) {
      return { x: null, y: null };
    }

    // Извлекаем X и Y значения из данных
    const xValues: number[] = [];
    const yValues: number[] = [];
    
    for (const s of series) {
      for (const point of s.points) {
        xValues.push(point.x);
        yValues.push(point.y);
      }
    }

    if (xValues.length === 0) {
      return { x: null, y: null };
    }

    // Получаем текущий zoom из interaction_state
    const currentZoom = interactionState?.zoom;
    
    // Если есть zoom, используем его, иначе используем полный диапазон данных
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xDomain: [number, number] = currentZoom?.x || [xMin, xMax];
    const yDomain: [number, number] = currentZoom?.y || [yMin, yMax];

    return { x: xDomain, y: yDomain };
  }, [series, interactionState?.zoom]);

  /**
   * Обработчик wheel для zoom
   * Zoom по X (и Y, если применимо)
   */
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      // Предотвращаем стандартное поведение прокрутки
      event.preventDefault();

      if (!containerRef.current || series.length === 0) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      // Координаты мыши относительно контейнера
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      // Получаем текущий domain
      const { x: xDomain, y: yDomain } = getCurrentDomain();
      if (!xDomain) {
        return;
      }

      // Определяем margins (соответствуют Observable Plot defaults)
      const marginLeft = 60;
      const marginRight = 20;
      const marginTop = 20;
      const marginBottom = 40;
      const innerWidth = containerRect.width - marginLeft - marginRight;
      const innerHeight = containerRect.height - marginTop - marginBottom;

      // Координаты мыши в области графика (без margins)
      const graphX = mouseX - marginLeft;
      const graphY = mouseY - marginTop;

      // Проверяем, что мышь в области графика
      if (graphX < 0 || graphX > innerWidth || graphY < 0 || graphY > innerHeight) {
        return;
      }

      // Коэффициент zoom (положительный deltaY = zoom out, отрицательный = zoom in)
      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
      const zoomSpeed = 0.1; // Скорость zoom
      const effectiveZoom = 1 + (zoomFactor - 1) * zoomSpeed;

      // Вычисляем позицию мыши в domain координатах
      const xRange = xDomain[1] - xDomain[0];
      const mouseXInDomain = xDomain[0] + (graphX / innerWidth) * xRange;

      // Применяем zoom относительно позиции мыши
      const newXRange = xRange * effectiveZoom;
      const newXMin = mouseXInDomain - (graphX / innerWidth) * newXRange;
      const newXMax = newXMin + newXRange;

      // Ограничиваем zoom (не позволяем zoom out больше исходного диапазона данных)
      const xValues: number[] = [];
      for (const s of series) {
        for (const point of s.points) {
          xValues.push(point.x);
        }
      }
      const dataXMin = Math.min(...xValues);
      const dataXMax = Math.max(...xValues);
      const dataXRange = dataXMax - dataXMin;

      // Если новый диапазон больше исходного, ограничиваем его
      let finalXMin = newXMin;
      let finalXMax = newXMax;
      if (newXRange > dataXRange) {
        finalXMin = dataXMin;
        finalXMax = dataXMax;
      } else {
        // Не позволяем выходить за границы данных
        if (finalXMin < dataXMin) {
          finalXMin = dataXMin;
          finalXMax = finalXMin + newXRange;
        }
        if (finalXMax > dataXMax) {
          finalXMax = dataXMax;
          finalXMin = finalXMax - newXRange;
        }
      }

      // Для Y-оси (если применимо)
      let finalYMin: number | undefined;
      let finalYMax: number | undefined;
      if (yDomain) {
        const yRange = yDomain[1] - yDomain[0];
        const mouseYInDomain = yDomain[0] + (1 - graphY / innerHeight) * yRange; // Y инвертирован

        const newYRange = yRange * effectiveZoom;
        const newYMin = mouseYInDomain - (1 - graphY / innerHeight) * newYRange;
        const newYMax = newYMin + newYRange;

        // Ограничиваем zoom для Y
        const yValues: number[] = [];
        for (const s of series) {
          for (const point of s.points) {
            yValues.push(point.y);
          }
        }
        const dataYMin = Math.min(...yValues);
        const dataYMax = Math.max(...yValues);
        const dataYRange = dataYMax - dataYMin;

        if (newYRange > dataYRange) {
          finalYMin = dataYMin;
          finalYMax = dataYMax;
        } else {
          finalYMin = newYMin;
          finalYMax = newYMax;
          if (finalYMin < dataYMin) {
            finalYMin = dataYMin;
            finalYMax = finalYMin + newYRange;
          }
          if (finalYMax > dataYMax) {
            finalYMax = dataYMax;
            finalYMin = finalYMax - newYRange;
          }
        }
      }

      // Обновляем interaction_state через shared_state
      updateInteractionState((prev) => ({
        ...prev,
        zoom: {
          x: [finalXMin, finalXMax],
          ...(finalYMin !== undefined && finalYMax !== undefined ? { y: [finalYMin, finalYMax] } : {}),
        },
        // Сбрасываем pan при zoom
        pan: undefined,
      }));
    },
    [containerRef, series, getCurrentDomain, updateInteractionState]
  );

  /**
   * Обработчик mousedown для начала pan
   * Начинает pan только если это не time_cursor drag
   */
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Начинаем pan только при клике на правой кнопке мыши или с модификатором
      // Или если это не time_cursor drag
      if (isTimeCursorDragging) {
        return;
      }

      // Для pan используем правую кнопку мыши (button === 2) или среднюю кнопку (button === 1)
      // Или левую кнопку с зажатым Ctrl/Cmd
      if (event.button === 0 && !event.ctrlKey && !event.metaKey) {
        // Левая кнопка без Ctrl/Cmd - это для time_cursor, не для pan
        return;
      }

      if (!containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      // Получаем текущий domain
      const { x: xDomain, y: yDomain } = getCurrentDomain();
      if (!xDomain) {
        return;
      }

      isPanningRef.current = true;
      panStartRef.current = {
        x: mouseX,
        y: mouseY,
        domainX: xDomain,
        domainY: yDomain || [0, 1],
      };

      // Предотвращаем выделение текста при drag
      event.preventDefault();
    },
    [containerRef, getCurrentDomain, isTimeCursorDragging]
  );

  /**
   * Обработчик mousemove для pan
   * Обновляет domain во время drag
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanningRef.current || !panStartRef.current || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const panStart = panStartRef.current; // Сохраняем для TypeScript
      
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      // Вычисляем смещение в пикселях
      const deltaX = mouseX - panStart.x;
      const deltaY = mouseY - panStart.y;

      // Определяем margins
      const marginLeft = 60;
      const marginRight = 20;
      const marginTop = 20;
      const marginBottom = 40;
      const innerWidth = containerRect.width - marginLeft - marginRight;
      const innerHeight = containerRect.height - marginTop - marginBottom;

      // Преобразуем смещение в пикселях в смещение в domain координатах
      const xRange = panStart.domainX[1] - panStart.domainX[0];
      const yRange = panStart.domainY[1] - panStart.domainY[0];

      const deltaXInDomain = -(deltaX / innerWidth) * xRange; // Инвертируем для pan
      const deltaYInDomain = (deltaY / innerHeight) * yRange; // Y инвертирован

      // Вычисляем новый domain
      let newXMin = panStart.domainX[0] + deltaXInDomain;
      let newXMax = panStart.domainX[1] + deltaXInDomain;
      let newYMin = panStart.domainY[0] + deltaYInDomain;
      let newYMax = panStart.domainY[1] + deltaYInDomain;

      // Ограничиваем pan границами данных
      const xValues: number[] = [];
      const yValues: number[] = [];
      for (const s of series) {
        for (const point of s.points) {
          xValues.push(point.x);
          yValues.push(point.y);
        }
      }
      const dataXMin = Math.min(...xValues);
      const dataXMax = Math.max(...xValues);
      const dataYMin = Math.min(...yValues);
      const dataYMax = Math.max(...yValues);

      // Ограничиваем X
      if (newXMin < dataXMin) {
        const offset = dataXMin - newXMin;
        newXMin = dataXMin;
        newXMax -= offset;
      }
      if (newXMax > dataXMax) {
        const offset = newXMax - dataXMax;
        newXMax = dataXMax;
        newXMin += offset;
      }

      // Ограничиваем Y
      if (newYMin < dataYMin) {
        const offset = dataYMin - newYMin;
        newYMin = dataYMin;
        newYMax -= offset;
      }
      if (newYMax > dataYMax) {
        const offset = newYMax - dataYMax;
        newYMax = dataYMax;
        newYMin += offset;
      }

      // Обновляем interaction_state через shared_state
      updateInteractionState((prev) => ({
        ...prev,
        zoom: {
          x: [newXMin, newXMax],
          ...(panStart.domainY ? { y: [newYMin, newYMax] } : {}),
        },
      }));
    },
    [containerRef, series, updateInteractionState]
  );

  /**
   * Обработчик mouseup для завершения pan
   */
  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  /**
   * Обработчик mouseleave для завершения pan
   */
  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  /**
   * Функция для сброса zoom/pan
   */
  const resetZoomPan = useCallback(() => {
    updateInteractionState((prev) => ({
      ...prev,
      zoom: undefined,
      pan: undefined,
    }));
  }, [updateInteractionState]);

  return {
    onWheel: handleWheel,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    resetZoomPan,
  };
};
