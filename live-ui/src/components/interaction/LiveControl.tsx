/**
 * LiveControl - компонент для управления live-режимом (play/pause)
 * Stage 7.5: Live Control
 * 
 * Отображает кнопки Play/Pause и визуальный индикатор live-режима
 * Компонент читает состояние из shared_state
 * Компонент вызывает методы useLiveMode
 * Никакой логики данных внутри компонента
 */

import React from 'react';
import { useLiveMode } from '../../hooks/useLiveMode';

/**
 * LiveControl компонент
 * Отображается в HeaderRegion, если layout содержит global_controls
 */
export const LiveControl: React.FC = () => {
  const { isPlaying, toggle } = useLiveMode();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        backgroundColor: '#fff',
      }}
    >
      {/* Кнопка Play/Pause */}
      <button
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: isPlaying ? '#4caf50' : '#fff',
          color: isPlaying ? '#fff' : '#333',
          cursor: 'pointer',
          fontSize: '16px',
          padding: 0,
          transition: 'background-color 0.2s',
        }}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          // Иконка Pause (две вертикальные линии)
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <rect x="3" y="2" width="2" height="8" />
            <rect x="7" y="2" width="2" height="8" />
          </svg>
        ) : (
          // Иконка Play (треугольник)
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M3 2 L3 10 L10 6 Z" />
          </svg>
        )}
      </button>

      {/* Индикатор live-режима */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          color: '#666',
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isPlaying ? '#4caf50' : '#ccc',
            animation: isPlaying ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span>{isPlaying ? 'Live' : 'Paused'}</span>
      </div>

      {/* CSS для анимации пульсации */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
};
