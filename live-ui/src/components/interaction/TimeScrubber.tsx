/**
 * TimeScrubber - компонент для ручного управления временем через slider
 * Stage 7.6: Manual Time Scrubbing
 * 
 * Отображает slider для выбора времени
 * Отображает текущий frameIndex/simTime
 * Отображает min/max диапазон
 * Компонент читает состояние из shared_state
 * Компонент обновляет time_cursor.value
 * При scrubbing автоматически ставит live_mode.is_playing = false
 * Никакой логики данных внутри компонента
 */

import React, { useCallback } from 'react';
import { useSharedState } from '../../context/SharedStateContext';
import { useTimeRange } from '../../hooks/useTimeRange';
import { useLiveMode } from '../../hooks/useLiveMode';

/**
 * TimeScrubber компонент
 * Отображается в HeaderRegion, если layout содержит time_cursor компонент
 */
export const TimeScrubber: React.FC = () => {
  const { sharedState, updateTimeCursor } = useSharedState();
  const { pause } = useLiveMode();
  const timeRange = useTimeRange();

  const timeCursor = sharedState.time_cursor;
  const axis = timeCursor?.axis ?? 'frameIndex';
  const currentValue = timeCursor?.value ?? null;
  const isPlaying = sharedState.live_mode?.is_playing ?? false;

  // Определяем min/max для slider
  const min = timeRange?.min ?? 0;
  const max = timeRange?.max ?? 100;
  const sliderValue = currentValue !== null ? currentValue : min;

  /**
   * Обработка изменения slider
   */
  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(event.target.value);

      // Обновляем time_cursor.value
      updateTimeCursor(newValue);

      // Если играет, ставим на pause
      if (isPlaying) {
        pause();
      }
    },
    [updateTimeCursor, isPlaying, pause]
  );

  /**
   * Обработка начала scrubbing (mousedown)
   * Ставим на pause при начале scrubbing, если играет
   */
  const handleMouseDown = useCallback(() => {
    if (isPlaying) {
      pause();
    }
  }, [isPlaying, pause]);

  /**
   * Форматирование значения для отображения
   */
  const formatValue = useCallback(
    (value: number): string => {
      if (axis === 'frameIndex') {
        return Math.round(value).toString();
      } else {
        // axis === 'simTime'
        return value.toFixed(2);
      }
    },
    [axis]
  );

  // Если нет диапазона, не отображаем scrubber
  if (!timeRange) {
    return (
      <div
        style={{
          padding: '8px 12px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px',
          backgroundColor: '#fff',
          color: '#999',
          fontSize: '14px',
          minWidth: '200px',
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        backgroundColor: '#fff',
        minWidth: '400px',
      }}
    >
      {/* Метка оси */}
      <div
        style={{
          fontSize: '12px',
          color: '#666',
          fontWeight: '500',
          minWidth: '80px',
        }}
      >
        {axis === 'frameIndex' ? 'Frame' : 'Time'}
      </div>

      {/* Min значение */}
      <div
        style={{
          fontSize: '12px',
          color: '#999',
          minWidth: '60px',
          textAlign: 'right',
        }}
      >
        {formatValue(min)}
      </div>

      {/* Slider */}
      <input
        type="range"
        min={min}
        max={max}
        value={sliderValue}
        step={axis === 'frameIndex' ? 1 : 0.01}
        onChange={handleSliderChange}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1,
          height: '6px',
          borderRadius: '3px',
          outline: 'none',
          cursor: 'pointer',
        }}
      />

      {/* Текущее значение */}
      <div
        style={{
          fontSize: '14px',
          color: '#333',
          fontWeight: '500',
          minWidth: '80px',
          textAlign: 'center',
        }}
      >
        {currentValue !== null ? formatValue(currentValue) : '—'}
      </div>

      {/* Max значение */}
      <div
        style={{
          fontSize: '12px',
          color: '#999',
          minWidth: '60px',
          textAlign: 'left',
        }}
      >
        {formatValue(max)}
      </div>
    </div>
  );
};
