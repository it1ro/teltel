# Migration Guide: Переход на относительные пути и nginx proxy

**Дата:** 2024  
**Версия:** 1.0  
**Статус:** ✅ Завершено

## Обзор

Этот документ описывает миграцию Live UI v2 с абсолютных URL на относительные пути через nginx proxy. Миграция устраняет проблемы CORS, упрощает конфигурацию и обеспечивает единообразие между dev и production окружениями.

## Что изменилось

### До миграции (AS-IS)

- **Абсолютные URL:** `ws://localhost:8081/ws`, `http://localhost:8081/api/*`
- **Конфигурация через environment variables:** `VITE_WS_URL`
- **Runtime конфигурация:** `config.js` с `window.__ENV__`
- **CORS проблемы:** Разные origin для браузера и backend
- **Разные конфигурации:** Dev и prod требуют разных настроек

### После миграции (TO-BE)

- **Относительные пути:** `/ws`, `/api/*`
- **Без конфигурации:** Не требуется `VITE_WS_URL`
- **nginx proxy:** Единая точка входа для браузера
- **Нет CORS:** Единый origin (`http://localhost:3000`)
- **Единая конфигурация:** Dev и prod используют одинаковые пути

## Изменения в коде

### 1. WebSocket URL

#### До:
```typescript
// src/utils/config.ts
export function getWebSocketUrl(): string {
  // Сложная логика с приоритетами
  if (window.__ENV__?.VITE_WS_URL) {
    return window.__ENV__.VITE_WS_URL;
  }
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  return 'ws://localhost:8080/ws'; // fallback
}
```

#### После:
```typescript
// src/utils/config.ts
export function getWebSocketUrl(): string {
  // Просто возвращаем относительный путь
  // Браузер автоматически использует текущий origin
  return '/ws';
}
```

### 2. HTTP API URL

#### До:
```typescript
// src/data/analysis.ts
class AnalysisClient {
  private baseUrl: string;
  
  constructor() {
    // Извлекаем базовый URL из WebSocket URL
    this.baseUrl = getApiBaseUrl(); // ws://host:port/ws → http://host:port
  }
  
  async getRuns(): Promise<Run[]> {
    const response = await fetch(`${this.baseUrl}/api/analysis/runs`);
    return response.json();
  }
}
```

#### После:
```typescript
// src/data/analysis.ts
class AnalysisClient {
  // Убрали baseUrl - используем относительные пути
  // Не нужна функция getApiBaseUrl()
  
  async getRuns(): Promise<Run[]> {
    // Относительный путь - работает в dev и prod
    const response = await fetch('/api/analysis/runs');
    return response.json();
  }
}
```

### 3. Упрощение конфигурации

#### Удалено:
- ❌ `getApiBaseUrl()` — больше не нужна
- ❌ Логика преобразования `ws://` → `http://`
- ❌ Fallback на `ws://localhost:8080/ws`
- ❌ Зависимость от `window.__ENV__`
- ❌ Зависимость от `VITE_WS_URL`

#### Оставлено:
- ✅ `getWebSocketUrl()` — возвращает `/ws`
- ✅ Относительные пути во всех запросах

## Изменения в конфигурации

### Docker Compose

#### До:
```yaml
services:
  live-ui:
    environment:
      - VITE_WS_URL=ws://localhost:8081/ws  # Требуется конфигурация
```

#### После:
```yaml
services:
  live-ui:
    # Конфигурация через environment variables больше не требуется
    # Все запросы используют относительные пути (/api/*, /ws)
```

### nginx конфигурация

#### Добавлено:
```nginx
# WebSocket proxy
location /ws {
    proxy_pass http://teltel:8080/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    # ... остальные настройки
}

# API proxy
location /api/ {
    proxy_pass http://teltel:8080/api/;
    proxy_http_version 1.1;
    # ... остальные настройки
}
```

### Vite конфигурация (dev-режим)

#### Добавлено:
```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:8080',
      ws: true,
      changeOrigin: true,
    },
  },
}
```

## Чеклист миграции

### Для разработчиков

- [x] ✅ Обновить код для использования относительных путей
- [x] ✅ Убрать зависимость от `VITE_WS_URL`
- [x] ✅ Упростить функции конфигурации (`getWebSocketUrl`, `getApiBaseUrl`)
- [x] ✅ Обновить все HTTP запросы на относительные пути
- [x] ✅ Обновить WebSocket подключения на относительный путь `/ws`
- [x] ✅ Убрать runtime конфигурацию через `config.js` (если не используется)
- [x] ✅ Обновить тесты (если есть)

### Для DevOps/инфраструктуры

- [x] ✅ Обновить `docker-compose.yml` (убрать `VITE_WS_URL`)
- [x] ✅ Обновить `nginx.conf` (добавить proxy для `/api/*` и `/ws`)
- [x] ✅ Обновить `vite.config.ts` (добавить proxy для dev-режима)
- [x] ✅ Проверить работу в dev-режиме
- [x] ✅ Проверить работу в Docker
- [x] ✅ Обновить документацию

## Тестирование

### Dev-режим

1. **Запустить backend:**
   ```bash
   go run cmd/teltel/main.go
   ```

2. **Запустить Live UI в dev-режиме:**
   ```bash
   cd live-ui
   npm run dev
   ```

3. **Проверить:**
   - Открыть `http://localhost:3000`
   - Проверить WebSocket подключение (должно быть `/ws`)
   - Проверить API запросы (должны быть `/api/*`)
   - Проверить консоль браузера (не должно быть CORS ошибок)

### Docker

1. **Запустить стек:**
   ```bash
   docker-compose up -d
   ```

2. **Проверить:**
   - Открыть `http://localhost:3000`
   - Проверить WebSocket подключение
   - Проверить API запросы
   - Проверить логи: `docker-compose logs live-ui`

3. **Проверить nginx конфигурацию:**
   ```bash
   docker-compose exec live-ui cat /etc/nginx/conf.d/default.conf
   ```

## Troubleshooting

### Проблема: WebSocket не подключается

**Симптомы:**
- WebSocket подключение не устанавливается
- Ошибки в консоли браузера

**Решение:**
1. Проверить, что backend запущен: `docker-compose ps`
2. Проверить nginx конфигурацию: `docker-compose exec live-ui cat /etc/nginx/conf.d/default.conf`
3. Проверить логи: `docker-compose logs live-ui`
4. Проверить доступность backend: `docker-compose exec live-ui wget -q -O- http://teltel:8080/api/health`

### Проблема: API запросы возвращают 502

**Симптомы:**
- API запросы возвращают 502 Bad Gateway
- Ошибки в логах nginx

**Решение:**
1. Проверить, что backend здоров: `docker-compose ps`
2. Проверить доступность backend: `docker-compose exec live-ui wget -q -O- http://teltel:8080/api/health`
3. Проверить сетевую конфигурацию: `docker network inspect teltel-network`

### Проблема: CORS ошибки

**Симптомы:**
- CORS ошибки в консоли браузера
- Запросы блокируются браузером

**Решение:**
1. Убедиться, что все запросы используют относительные пути (`/api/*`, `/ws`)
2. Проверить, что нет прямых обращений к `localhost:8081`
3. Проверить консоль браузера на наличие абсолютных URL

### Проблема: Разные порты в dev и prod

**Симптомы:**
- Разное поведение в dev и prod
- Ошибки подключения

**Решение:**
- Убедиться, что используются относительные пути (не зависят от портов)
- Проверить, что Vite proxy настроен корректно в `vite.config.ts`
- Проверить, что nginx proxy настроен корректно в `nginx.conf`

## Обратная совместимость

### Старые конфигурации

Если в коде остались старые абсолютные URL, они могут продолжать работать, но рекомендуется мигрировать на относительные пути:

```typescript
// Старый код (может работать, но не рекомендуется)
const wsUrl = 'ws://localhost:8081/ws';

// Новый код (рекомендуется)
const wsUrl = '/ws';
```

### Постепенная миграция

Если требуется постепенная миграция, можно добавить проверку:

```typescript
function getWebSocketUrl(): string {
  // Поддержка старого формата (для обратной совместимости)
  const oldUrl = window.__ENV__?.VITE_WS_URL || import.meta.env.VITE_WS_URL;
  if (oldUrl && (oldUrl.startsWith('ws://') || oldUrl.startsWith('wss://'))) {
    console.warn('Использование абсолютного URL устарело. Используйте относительный путь /ws');
    return oldUrl;
  }
  // Новый формат (относительный путь)
  return '/ws';
}
```

**Примечание:** В текущей реализации обратная совместимость не поддерживается, так как миграция завершена.

## Следующие шаги

После завершения миграции:

1. ✅ Убрать `VITE_WS_URL` из всех конфигураций
2. ✅ Упростить конфигурацию Live UI
3. ✅ Обеспечить dev/prod parity
4. ✅ Документировать архитектуру

**Статус:** ✅ Все этапы завершены

## Ссылки

- [NGINX_PROXY_ARCHITECTURE.md](./NGINX_PROXY_ARCHITECTURE.md) — архитектура nginx proxy
- [README.md](./README.md) — документация Live UI
- [Roadmap: nginx proxy и fetch API](../../.cursor/plans/nginx_proxy_и_fetch_api_roadmap_530f1365.plan.md) — полный roadmap миграции
