# План проверки dev/prod parity

## Обзор

Документ описывает план обеспечения одинакового поведения Live UI v2 в dev и production окружениях после миграции на относительные пути и nginx proxy.

**Дата создания:** 2024  
**Версия:** 1.0  
**Статус:** План готов к реализации

---

## Архитектурный контекст

### Цель

Обеспечить единообразие dev и prod окружений:
- Одинаковые относительные пути в коде (`/api/*`, `/ws`)
- Dev: Vite dev server проксирует запросы к `localhost:8080`
- Prod: nginx проксирует запросы к `teltel:8080` (Docker сеть)
- Одинаковое поведение для разработчиков и пользователей

### Входные условия

- ✅ Завершены Этапы 4 и 5 (миграция на относительные пути)
- ✅ Завершён Этап 2 (проектирование nginx)
- ✅ Код использует относительные пути (`/api/*`, `/ws`)
- ✅ nginx proxy настроен для production

---

## Конфигурация Vite dev server proxy

### Настройка proxy в vite.config.ts

```typescript
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      // Проксирование HTTP API запросов к backend
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // Проксирование WebSocket подключений к backend
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
```

### Описание настроек

#### HTTP API proxy (`/api`)

- **target:** `http://localhost:8080` — локальный backend (dev-режим)
- **changeOrigin:** `true` — изменяет заголовок `Host` на target
- **rewrite:** сохраняет путь `/api/...` без изменений

**Поведение:**
- Запрос `GET /api/runs` → проксируется к `http://localhost:8080/api/runs`
- Запрос `GET /api/analysis/runs` → проксируется к `http://localhost:8080/api/analysis/runs`
- Все заголовки передаются корректно

#### WebSocket proxy (`/ws`)

- **target:** `ws://localhost:8080` — локальный WebSocket endpoint
- **ws:** `true` — включает поддержку WebSocket proxy
- **changeOrigin:** `true` — изменяет заголовок `Host`
- **rewrite:** сохраняет путь `/ws` без изменений

**Поведение:**
- WebSocket upgrade запрос → проксируется к `ws://localhost:8080/ws`
- WebSocket сообщения передаются bidirectionally
- Поддержка long-lived connections

### Сравнение dev и prod конфигураций

| Аспект | Dev (Vite) | Prod (nginx) |
|--------|-----------|--------------|
| **Порт frontend** | `3000` | `3000` (host) → `80` (container) |
| **Backend адрес** | `localhost:8080` | `teltel:8080` (Docker сеть) |
| **Proxy для `/api/*`** | Vite proxy | nginx `proxy_pass` |
| **Proxy для `/ws`** | Vite proxy (ws: true) | nginx WebSocket upgrade |
| **Относительные пути** | `/api/*`, `/ws` | `/api/*`, `/ws` |
| **CORS** | Не нужен (единый origin) | Не нужен (единый origin) |

**Ключевое преимущество:** Одинаковые относительные пути в коде работают в обоих окружениях.

---

## План тестирования

### 1. Тестирование в dev-режиме

#### Предварительные условия

- Backend teltel запущен на `localhost:8080`
- Live UI запущен через `npm run dev` (Vite dev server на `localhost:3000`)

#### Тестовые сценарии

##### 1.1. HTTP API endpoints

```bash
# Health check через proxy
curl http://localhost:3000/api/health
# Ожидается: {"status":"ok"}

# Список активных run'ов
curl http://localhost:3000/api/runs
# Ожидается: JSON массив run'ов

# Список завершённых run'ов
curl http://localhost:3000/api/analysis/runs
# Ожидается: JSON массив run'ов

# Метаданные run'а
curl "http://localhost:3000/api/run?runId=run-123"
# Ожидается: JSON с метаданными run'а

# Временной ряд
curl "http://localhost:3000/api/analysis/series?runId=run-123&eventType=state&sourceId=flight&jsonPath=altitude"
# Ожидается: JSONEachRow формат
```

**Проверка:**
- ✅ Все запросы успешно проксируются
- ✅ Ответы корректны
- ✅ Заголовки передаются правильно
- ✅ Нет CORS ошибок в браузере

##### 1.2. WebSocket подключение

```bash
# Использование wscat для тестирования WebSocket
wscat -c ws://localhost:3000/ws

# Или через браузер DevTools:
# 1. Открыть консоль
# 2. Выполнить:
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onerror = (e) => console.error('Error:', e);
```

**Проверка:**
- ✅ WebSocket успешно подключается
- ✅ Сообщения передаются bidirectionally
- ✅ Long-lived connection работает
- ✅ Переподключение работает при разрыве

##### 1.3. Интеграция в браузере

1. Открыть `http://localhost:3000` в браузере
2. Проверить Network tab в DevTools:
   - Все запросы к `/api/*` идут через Vite proxy
   - WebSocket подключение к `/ws` работает
   - Нет CORS ошибок
3. Проверить функциональность:
   - Загрузка layout
   - Подключение к WebSocket
   - Загрузка данных через API
   - Отображение графиков

**Проверка:**
- ✅ UI загружается корректно
- ✅ Все API запросы работают
- ✅ WebSocket подключение стабильно
- ✅ Нет ошибок в консоли

### 2. Тестирование в production (Docker)

#### Предварительные условия

- Docker Compose запущен (`docker-compose up`)
- Backend teltel доступен внутри Docker сети на `teltel:8080`
- Live UI доступен на `localhost:3000` (nginx:80 внутри контейнера)

#### Тестовые сценарии

##### 2.1. HTTP API endpoints

```bash
# Health check nginx контейнера
curl http://localhost:3000/health
# Ожидается: "healthy\n"

# Health check backend через proxy
curl http://localhost:3000/api/health
# Ожидается: {"status":"ok"}

# Список активных run'ов
curl http://localhost:3000/api/runs
# Ожидается: JSON массив run'ов

# Список завершённых run'ов
curl http://localhost:3000/api/analysis/runs
# Ожидается: JSON массив run'ов
```

**Проверка:**
- ✅ Все запросы успешно проксируются через nginx
- ✅ Ответы корректны
- ✅ Заголовки передаются правильно (X-Real-IP, X-Forwarded-For)
- ✅ Нет CORS ошибок в браузере

##### 2.2. WebSocket подключение

```bash
# Использование wscat для тестирования WebSocket
wscat -c ws://localhost:3000/ws
```

**Проверка:**
- ✅ WebSocket успешно подключается через nginx proxy
- ✅ WebSocket upgrade работает корректно
- ✅ Сообщения передаются bidirectionally
- ✅ Long-lived connection работает (таймауты 3600s)
- ✅ Переподключение работает при разрыве

##### 2.3. Интеграция в браузере

1. Открыть `http://localhost:3000` в браузере
2. Проверить Network tab в DevTools:
   - Все запросы к `/api/*` идут через nginx proxy
   - WebSocket подключение к `/ws` работает через nginx
   - Нет CORS ошибок
3. Проверить функциональность:
   - Загрузка layout
   - Подключение к WebSocket
   - Загрузка данных через API
   - Отображение графиков

**Проверка:**
- ✅ UI загружается корректно
- ✅ Все API запросы работают
- ✅ WebSocket подключение стабильно
- ✅ Нет ошибок в консоли

### 3. Сравнительное тестирование

#### Проверка идентичности поведения

| Функция | Dev (Vite) | Prod (nginx) | Статус |
|---------|-----------|--------------|--------|
| HTTP API запросы | ✅ | ✅ | Одинаково |
| WebSocket подключение | ✅ | ✅ | Одинаково |
| Относительные пути | ✅ | ✅ | Одинаково |
| CORS | ✅ Нет проблем | ✅ Нет проблем | Одинаково |
| Обработка ошибок | ✅ | ✅ | Одинаково |
| Переподключение | ✅ | ✅ | Одинаково |

**Критерий успеха:** Все функции работают идентично в обоих окружениях.

---

## Обработка edge cases

### 1. Разные порты в dev и prod

**Проблема:** Backend может быть на разных портах в dev и prod.

**Решение:**
- Dev: `localhost:8080` (локальный backend)
- Prod: `teltel:8080` (Docker сеть)
- Код использует относительные пути, поэтому порты не важны
- Vite proxy и nginx proxy скрывают различия

**Проверка:**
- ✅ Код не содержит hardcoded портов
- ✅ Относительные пути работают независимо от портов

### 2. Разные протоколы (http vs https)

**Проблема:** В будущем может потребоваться HTTPS.

**Решение:**
- Текущая реализация поддерживает только HTTP/WS
- Для HTTPS потребуется:
  - Обновить nginx конфигурацию для SSL
  - Обновить Vite proxy для HTTPS (если нужно)
  - Использовать `wss://` для WebSocket
- Код использует относительные пути, поэтому протокол определяется автоматически

**Проверка:**
- ✅ Код не содержит hardcoded протоколов
- ✅ `normalizeWebSocketUrl()` в `config.ts` обрабатывает `wss://`

### 3. Обработка ошибок подключения

**Проблема:** Backend может быть недоступен.

**Решение:**
- Vite proxy: возвращает ошибку подключения (502 Bad Gateway)
- nginx proxy: возвращает ошибку подключения (502 Bad Gateway)
- Клиентский код обрабатывает ошибки через try/catch и onError callbacks

**Проверка:**
- ✅ Остановить backend → проверить обработку ошибок в UI
- ✅ Ошибки отображаются пользователю корректно
- ✅ Переподключение работает при восстановлении backend

### 4. Различия в таймаутах

**Проблема:** Vite и nginx могут иметь разные таймауты.

**Решение:**
- Vite: использует таймауты по умолчанию (достаточно для большинства случаев)
- nginx: настроены явные таймауты (60s для HTTP, 3600s для WebSocket)
- Если нужны более длинные таймауты, можно настроить в Vite

**Проверка:**
- ✅ Обычные запросы работают в обоих окружениях
- ✅ Long-lived WebSocket connections работают в обоих окружениях

### 5. Различия в заголовках

**Проблема:** Vite и nginx могут передавать разные заголовки.

**Решение:**
- Vite: `changeOrigin: true` устанавливает правильный `Host`
- nginx: явно устанавливает `Host`, `X-Real-IP`, `X-Forwarded-For`
- Backend должен работать с обоими вариантами

**Проверка:**
- ✅ Запросы работают в обоих окружениях
- ✅ Backend получает корректные заголовки

---

## Риски и меры снижения

### Риск 1: Vite dev server не поддерживает WebSocket proxy корректно

**Вероятность:** Низкая  
**Влияние:** Высокое

**Меры снижения:**
- Использовать встроенный WebSocket proxy Vite (`ws: true`)
- Тестировать WebSocket подключение на каждом этапе
- Если проблемы, использовать альтернативные решения (например, http-proxy-middleware)

**Проверка:**
- ✅ WebSocket подключение работает в dev-режиме
- ✅ Сообщения передаются bidirectionally
- ✅ Long-lived connections работают

### Риск 2: Различия в поведении между Vite proxy и nginx proxy

**Вероятность:** Средняя  
**Влияние:** Среднее

**Меры снижения:**
- Тестировать оба окружения на одинаковых сценариях
- Использовать одинаковые относительные пути в коде
- Документировать различия (если неизбежны)

**Проверка:**
- ✅ Все тесты проходят в обоих окружениях
- ✅ Поведение идентично для пользователя

### Риск 3: Проблемы с переподключением в разных окружениях

**Вероятность:** Низкая  
**Влияние:** Среднее

**Меры снижения:**
- Логика переподключения реализована в клиентском коде (не зависит от proxy)
- Тестировать переподключение в обоих окружениях

**Проверка:**
- ✅ Переподключение работает в dev-режиме
- ✅ Переподключение работает в prod (Docker)

---

## Чеклист реализации

### Настройка Vite proxy

- [x] Обновить `vite.config.ts` с proxy настройками
- [x] Настроить proxy для `/api/*`
- [x] Настроить proxy для `/ws` с WebSocket поддержкой
- [x] Проверить синтаксис конфигурации

### Тестирование dev-режима

- [ ] Запустить backend на `localhost:8080`
- [ ] Запустить Live UI через `npm run dev`
- [ ] Проверить HTTP API endpoints через proxy
- [ ] Проверить WebSocket подключение через proxy
- [ ] Проверить интеграцию в браузере
- [ ] Проверить обработку ошибок

### Тестирование production

- [ ] Запустить Docker Compose
- [ ] Проверить HTTP API endpoints через nginx proxy
- [ ] Проверить WebSocket подключение через nginx proxy
- [ ] Проверить интеграцию в браузере
- [ ] Проверить обработку ошибок

### Сравнительное тестирование

- [ ] Сравнить поведение HTTP API в dev и prod
- [ ] Сравнить поведение WebSocket в dev и prod
- [ ] Убедиться в идентичности поведения
- [ ] Документировать различия (если есть)

### Обработка edge cases

- [ ] Проверить работу с разными портами
- [ ] Проверить обработку ошибок подключения
- [ ] Проверить таймауты для long-lived connections
- [ ] Проверить передачу заголовков

---

## Следующие шаги

После завершения Этапа 6:

1. ✅ **Этап 6 завершён** — План проверки dev/prod parity
2. ⏭️ **Этап 7** — Документация и фиксация решения

---

## Приложение: Примеры конфигураций

### Vite dev server proxy (vite.config.ts)

```typescript
export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
});
```

### nginx proxy (nginx.conf)

```nginx
location /api/ {
    proxy_pass http://teltel:8080/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    proxy_connect_timeout 10s;
    proxy_buffering on;
}

location /ws {
    proxy_pass http://teltel:8080/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;
    proxy_buffering off;
}
```

### Код использует относительные пути

```typescript
// src/utils/config.ts
export function getWebSocketUrl(): string {
  return '/ws';  // Относительный путь
}

export function getApiBaseUrl(): string {
  return '';  // Пустая строка для относительных путей
}

// src/data/analysis.ts
const response = await fetch('/api/analysis/runs');  // Относительный путь

// src/data/websocket.ts
const ws = new WebSocket('/ws');  // Относительный путь
```

---

**Статус:** ✅ План готов к реализации  
**Готовность к тестированию:** ⏳ Требуется выполнение чеклиста
