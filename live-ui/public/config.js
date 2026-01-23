/**
 * Runtime конфигурация для Live UI
 * Этот файл загружается перед React и устанавливает window.__ENV__
 * 
 * В production этот файл может быть заменен через nginx template
 * или генерироваться динамически на основе environment variables
 */

// Установка runtime конфигурации
window.__ENV__ = window.__ENV__ || {};

// Пример конфигурации (в production будет заменен через nginx или env vars)
// Для dev-режима эти значения могут быть пустыми (будет использован fallback)
if (!window.__ENV__.VITE_WS_URL) {
  // В dev-режиме оставляем пустым, чтобы использовался fallback из config.ts
  // window.__ENV__.VITE_WS_URL = 'ws://localhost:8080/ws';
}

// Опционально: URL для загрузки layout из backend
// window.__ENV__.VITE_LAYOUT_URL = 'http://localhost:8080/api/layout';
