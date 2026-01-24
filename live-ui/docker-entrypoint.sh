#!/bin/sh
# Entrypoint скрипт для генерации config.js из environment variables
# Это позволяет настраивать конфигурацию в runtime без пересборки образа
# 
# После миграции на относительные пути, VITE_WS_URL больше не используется
# Остается только VITE_LAYOUT_URL для опциональной конфигурации

set -e

# Путь к config.js
CONFIG_JS_PATH="/usr/share/nginx/html/config.js"

# Генерируем config.js из environment variables
cat > "$CONFIG_JS_PATH" <<EOF
/**
 * Runtime конфигурация для Live UI
 * Автоматически сгенерировано из environment variables
 * 
 * WebSocket URL теперь использует относительный путь /ws (настроен в коде)
 * и не требует runtime конфигурации
 */

window.__ENV__ = window.__ENV__ || {};

EOF

# Добавляем VITE_LAYOUT_URL если установлен (опционально)
if [ -n "$VITE_LAYOUT_URL" ]; then
    echo "window.__ENV__.VITE_LAYOUT_URL = '${VITE_LAYOUT_URL}';" >> "$CONFIG_JS_PATH"
fi

# Запускаем nginx с переданными аргументами
exec "$@"
