/**
 * Конфигурация приложения
 * Использует относительные пути для работы через nginx proxy
 */

/**
 * Получение WebSocket URL
 * Возвращает относительный путь для работы через nginx proxy
 * Браузер автоматически преобразует относительный путь в абсолютный URL
 * на основе текущего origin (например, /ws -> ws://localhost:3000/ws)
 */
export function getWebSocketUrl(): string {
  // Возвращаем относительный путь - браузер автоматически преобразует его
  // в абсолютный URL на основе текущего origin
  return '/ws';
}

/**
 * Преобразование относительного WebSocket URL в абсолютный
 * Используется для обеспечения совместимости, если требуется абсолютный URL
 */
export function normalizeWebSocketUrl(url: string): string {
  // Если URL уже абсолютный (начинается с ws:// или wss://), возвращаем как есть
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    return url;
  }

  // Если URL относительный, преобразуем в абсолютный на основе текущего origin
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Убираем ведущий слэш если есть, и добавляем его обратно
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${protocol}//${host}${path}`;
  }

  // Fallback для SSR или других случаев
  return url;
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
