/**
 * Window Logic - применение window ограничений
 * frames: последние N кадров
 * time: последние T секунд
 * all: без ограничений
 */

import type { Event } from './types';
import type { ChartSpec } from '../types';

/**
 * Применение window ограничения к событиям
 */
export function applyWindow(
  events: Event[],
  window: ChartSpec['data_source']['window']
): Event[] {
  if (!window || window.type === 'all') {
    return events;
  }

  if (events.length === 0) {
    return events;
  }

  // Сортируем по frameIndex (основная ось)
  const sorted = [...events].sort((a, b) => a.frameIndex - b.frameIndex);

  if (window.type === 'frames') {
    const size = window.size || 1000;
    // Берем последние N кадров
    return sorted.slice(-size);
  }

  if (window.type === 'time') {
    const duration = window.duration || 10.0;
    // Находим максимальное simTime
    const maxTime = Math.max(...sorted.map((e) => e.simTime));
    const minTime = maxTime - duration;

    // Фильтруем события в окне времени
    return sorted.filter((e) => e.simTime >= minTime);
  }

  return events;
}

/**
 * Получение предиката для удаления событий вне window
 */
export function getWindowPredicate(
  window: ChartSpec['data_source']['window'],
  allEvents: Event[]
): ((event: Event) => boolean) | null {
  if (!window || window.type === 'all') {
    return null; // Не удаляем ничего
  }

  if (allEvents.length === 0) {
    return null;
  }

  // Сортируем по frameIndex
  const sorted = [...allEvents].sort((a, b) => a.frameIndex - b.frameIndex);

  if (window.type === 'frames') {
    const size = window.size || 1000;
    if (sorted.length <= size) {
      return null; // Все события в окне
    }

    // Находим минимальный frameIndex для сохранения
    const minFrameIndex = sorted[sorted.length - size].frameIndex;

    return (event: Event) => event.frameIndex < minFrameIndex;
  }

  if (window.type === 'time') {
    const duration = window.duration || 10.0;
    const maxTime = Math.max(...sorted.map((e) => e.simTime));
    const minTime = maxTime - duration;

    return (event: Event) => event.simTime < minTime;
  }

  return null;
}
