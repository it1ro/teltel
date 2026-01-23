#!/bin/sh
# Entrypoint скрипт для генерации config.js из environment variables
# Это позволяет настраивать конфигурацию в runtime без пересборки образа

set -e

# Путь к config.js
CONFIG_JS_PATH="/usr/share/nginx/html/config.js"

# Генерируем config.js из environment variables
cat > "$CONFIG_JS_PATH" <<EOF
/**
 * Runtime конфигурация для Live UI
 * Автоматически сгенерировано из environment variables
 */

window.__ENV__ = window.__ENV__ || {};

EOF

# Добавляем VITE_WS_URL если установлен
if [ -n "$VITE_WS_URL" ]; then
    echo "window.__ENV__.VITE_WS_URL = '${VITE_WS_URL}';" >> "$CONFIG_JS_PATH"
fi

# Добавляем VITE_LAYOUT_URL если установлен
if [ -n "$VITE_LAYOUT_URL" ]; then
    echo "window.__ENV__.VITE_LAYOUT_URL = '${VITE_LAYOUT_URL}';" >> "$CONFIG_JS_PATH"
fi

# Запускаем nginx с переданными аргументами
exec "$@"
