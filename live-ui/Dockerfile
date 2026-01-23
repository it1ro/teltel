# Multi-stage build для Live UI
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package files для кэширования слоя зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Build-time переменные окружения (Vite инжектирует их в код)
ARG VITE_WS_URL
ARG VITE_LAYOUT_URL

ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_LAYOUT_URL=${VITE_LAYOUT_URL}

# Собираем production build
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Копируем собранные файлы из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем entrypoint скрипт для генерации config.js
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Runtime переменные окружения (для config.js)
ENV VITE_WS_URL=""
ENV VITE_LAYOUT_URL=""

EXPOSE 80

# Используем entrypoint для генерации config.js перед запуском nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
