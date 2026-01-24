/**
 * Runtime конфигурация для Live UI
 * Этот файл загружается перед React и устанавливает window.__ENV__
 * 
 * В production этот файл генерируется через docker-entrypoint.sh
 * на основе environment variables
 * 
 * WebSocket URL теперь использует относительный путь /ws (настроен в коде)
 * и не требует runtime конфигурации
 */

// Установка runtime конфигурации
window.__ENV__ = window.__ENV__ || {};

// Опционально: URL для загрузки layout из backend
// Может быть установлен через docker-entrypoint.sh из VITE_LAYOUT_URL env var
// window.__ENV__.VITE_LAYOUT_URL = 'http://localhost:8080/api/layout';
