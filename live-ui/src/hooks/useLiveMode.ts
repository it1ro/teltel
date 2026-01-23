/**
 * useLiveMode - hook для управления live-режимом (play/pause)
 * Stage 7.5: Live Control
 * 
 * Управляет live_mode.is_playing через shared_state
 * Автоматически обновляет time_cursor.value при play
 * Останавливает обновления при pause
 * 
 * Hook не знает про визуализацию
 * Hook не хранит состояние
 * Hook использует Data Layer ТОЛЬКО для чтения
 */

import { useEffect, useCallback, useRef } from 'react';
import { useSharedState } from '../context/SharedStateContext';
import { useDataLayerContext } from '../context/DataLayerContext';
import type { Event } from '../data/types';

/**
 * useLiveMode возвращает методы для управления live-режимом
 * 
 * @returns объект с методами play, pause, toggle и состоянием isPlaying
 */
export const useLiveMode = () => {
  const { sharedState, updateLiveMode, updateTimeCursor } = useSharedState();
  const dataLayer = useDataLayerContext();
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isPlaying = sharedState.live_mode?.is_playing ?? false;
  const axis = sharedState.time_cursor?.axis ?? 'frameIndex';
  const selectedRunId = sharedState.selected_run?.run_id;

  /**
   * Получение последнего значения frameIndex или simTime из данных
   */
  const getLatestValue = useCallback((): number | null => {
    if (!dataLayer) {
      return null;
    }

    // Получаем все события из buffer
    const allEvents = dataLayer.getAllEvents();

    if (allEvents.length === 0) {
      return null;
    }

    // Фильтруем по selected_run, если он указан
    let events = allEvents;
    if (selectedRunId) {
      events = events.filter((e) => e.runId === selectedRunId);
    }

    if (events.length === 0) {
      return null;
    }

    // Находим последнее событие по axis
    let latestEvent: Event | null = null;
    if (axis === 'frameIndex') {
      latestEvent = events.reduce((latest, current) => {
        return current.frameIndex > latest.frameIndex ? current : latest;
      });
    } else {
      // axis === 'simTime'
      latestEvent = events.reduce((latest, current) => {
        return current.simTime > latest.simTime ? current : latest;
      });
    }

    if (!latestEvent) {
      return null;
    }

    // Возвращаем значение в зависимости от axis
    return axis === 'frameIndex' ? latestEvent.frameIndex : latestEvent.simTime;
  }, [dataLayer, selectedRunId, axis]);

  /**
   * Обновление time_cursor.value на последнее значение из данных
   */
  const updateTimeCursorToLatest = useCallback(() => {
    const latestValue = getLatestValue();
    if (latestValue !== null) {
      updateTimeCursor(latestValue);
    }
  }, [getLatestValue, updateTimeCursor]);

  /**
   * Запуск автоматического обновления time_cursor
   */
  const startAutoUpdate = useCallback(() => {
    // Очищаем предыдущий интервал, если есть
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // Обновляем сразу
    updateTimeCursorToLatest();

    // Устанавливаем интервал для периодического обновления (каждые 100ms)
    updateIntervalRef.current = setInterval(() => {
      updateTimeCursorToLatest();
    }, 100);
  }, [updateTimeCursorToLatest]);

  /**
   * Остановка автоматического обновления time_cursor
   */
  const stopAutoUpdate = useCallback(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  }, []);

  /**
   * Обработка изменений is_playing
   */
  useEffect(() => {
    if (isPlaying) {
      startAutoUpdate();
    } else {
      stopAutoUpdate();
    }

    return () => {
      stopAutoUpdate();
    };
  }, [isPlaying, startAutoUpdate, stopAutoUpdate]);


  /**
   * Метод play - запускает воспроизведение
   */
  const play = useCallback(() => {
    updateLiveMode({
      is_playing: true,
      playback_speed: sharedState.live_mode?.playback_speed ?? 1.0,
    });
  }, [updateLiveMode, sharedState.live_mode?.playback_speed]);

  /**
   * Метод pause - останавливает воспроизведение
   */
  const pause = useCallback(() => {
    updateLiveMode((prev) => ({
      ...prev,
      is_playing: false,
    }));
  }, [updateLiveMode]);

  /**
   * Метод toggle - переключает play/pause
   */
  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  return {
    isPlaying,
    play,
    pause,
    toggle,
  };
};
