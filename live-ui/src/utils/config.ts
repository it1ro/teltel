/**
 * Конфигурация приложения
 * Поддерживает build-time (Vite) и runtime конфигурацию
 */

/**
 * Интерфейс для runtime конфигурации (window.__ENV__)
 */
interface RuntimeConfig {
  VITE_WS_URL?: string;
  VITE_LAYOUT_URL?: string;
}

/**
 * Расширение Window для runtime конфигурации
 */
declare global {
  interface Window {
    __ENV__?: RuntimeConfig;
  }
}

/**
 * Получение WebSocket URL из конфигурации
 * Приоритет:
 * 1. window.__ENV__.VITE_WS_URL (runtime, production)
 * 2. import.meta.env.VITE_WS_URL (build-time, Vite)
 * 3. ws://localhost:8080/ws (fallback для dev)
 */
export function getWebSocketUrl(): string {
  // Runtime конфигурация (для production через config.js)
  if (typeof window !== 'undefined' && window.__ENV__) {
    if (window.__ENV__.VITE_WS_URL) {
      return window.__ENV__.VITE_WS_URL;
    }
  }

  // Build-time конфигурация (Vite env vars)
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Fallback для dev-режима
  return 'ws://localhost:8080/ws';
}

/**
 * Получение Layout URL из конфигурации (опционально)
 * Приоритет:
 * 1. window.__ENV__.VITE_LAYOUT_URL (runtime, production)
 * 2. import.meta.env.VITE_LAYOUT_URL (build-time, Vite)
 * 3. undefined (используется статический файл)
 */
export function getLayoutUrl(): string | undefined {
  // Runtime конфигурация
  if (typeof window !== 'undefined' && window.__ENV__) {
    if (window.__ENV__.VITE_LAYOUT_URL) {
      return window.__ENV__.VITE_LAYOUT_URL;
    }
  }

  // Build-time конфигурация
  if (import.meta.env.VITE_LAYOUT_URL) {
    return import.meta.env.VITE_LAYOUT_URL;
  }

  return undefined;
}

/**
 * Получение всей конфигурации
 */
export function getConfig() {
  return {
    wsUrl: getWebSocketUrl(),
    layoutUrl: getLayoutUrl(),
  };
}
