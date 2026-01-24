/**
 * Конфигурация приложения
 * Использует относительные пути для работы через nginx proxy
 */

/**
 * Получение WebSocket URL
 * Возвращает относительный путь для работы через nginx proxy
 */
export function getWebSocketUrl(): string {
  return '/ws';
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
 * Получение базового URL для HTTP API
 * Возвращает пустую строку для использования относительных путей
 */
export function getApiBaseUrl(): string {
  return '';
}

/**
 * Получение всей конфигурации
 */
export function getConfig() {
  return {
    wsUrl: getWebSocketUrl(),
    layoutUrl: getLayoutUrl(),
    apiBaseUrl: getApiBaseUrl(),
  };
}
