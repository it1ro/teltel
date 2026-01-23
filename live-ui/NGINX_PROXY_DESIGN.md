# Проектирование nginx proxy конфигурации

## Обзор

Документ описывает проектирование nginx proxy конфигурации для Live UI v2, которая обеспечивает:
- Проксирование всех API запросов к backend teltel
- Проксирование WebSocket подключений
- Единую точку входа для браузера (устранение CORS проблем)
- Единообразие dev/prod окружений

**Дата создания:** 2024  
**Версия:** 1.0  
**Статус:** Проектирование завершено

---

## Архитектурный контекст

### Текущее состояние (AS-IS)

- Live UI работает на порту `3000` (nginx:80 внутри контейнера)
- Backend teltel доступен на порту `8080` внутри Docker сети
- Браузер обращается напрямую к `localhost:8081` (внешний порт backend)
- Разные origin → CORS проблемы

### Целевое состояние (TO-BE)

- Браузер обращается только к `localhost:3000` (Live UI)
- nginx проксирует все запросы к backend через Docker сеть
- Единый origin → нет CORS проблем
- Backend доступен только внутри Docker сети

---

## Структура API endpoints

### HTTP API endpoints

Все endpoints начинаются с `/api/`:

#### Live API (Phase 1)
- `POST /api/ingest` — ingest NDJSON потока
- `GET /api/runs` — список активных run'ов
- `GET /api/run?runId=...` — метаданные конкретного run'а
- `GET /api/health` — health check backend

#### Analysis API (Phase 3, опционально)
- `GET /api/analysis/runs` — список завершённых run'ов
- `GET /api/analysis/run/{runId}` — метаданные завершённого run'а
- `GET /api/analysis/series` — временной ряд для run'а
- `GET /api/analysis/compare` — сравнение нескольких run'ов
- `POST /api/analysis/query` — произвольный SQL SELECT запрос

### WebSocket endpoint

- `GET /ws` — WebSocket подключение для live событий

---

## Проектирование location blocks

### Приоритет location blocks

В nginx порядок location blocks критичен. Более специфичные блоки должны идти первыми:

1. **Точные совпадения** (`location = /path`) — высший приоритет
2. **Префиксные с `^~`** (`location ^~ /prefix`) — второй приоритет
3. **Регулярные выражения** (`location ~ /pattern`) — третий приоритет
4. **Префиксные** (`location /prefix`) — низший приоритет

### Спецификация location blocks

#### 1. Health check endpoint

```nginx
location = /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}
```

**Описание:**  
Health check для Docker healthcheck. Остаётся без изменений, так как это endpoint самого nginx контейнера.

**Приоритет:** Высший (точное совпадение)

---

#### 2. WebSocket proxy

```nginx
location /ws {
    proxy_pass http://teltel:8080/ws;
    proxy_http_version 1.1;
    
    # WebSocket upgrade заголовки
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Proxy заголовки
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Таймауты для long-lived connections
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_connect_timeout 60s;
    
    # Отключаем буферизацию для WebSocket
    proxy_buffering off;
}
```

**Описание:**  
Проксирует WebSocket подключения к backend. Критически важно настроить заголовки `Upgrade` и `Connection` для WebSocket upgrade.

**Приоритет:** Высокий (префиксный блок перед `/api/`)

**Важные настройки:**
- `proxy_http_version 1.1` — требуется для WebSocket
- `Upgrade: websocket` и `Connection: upgrade` — обязательные заголовки
- Длинные таймауты (3600s) для long-lived connections
- `proxy_buffering off` — отключает буферизацию для real-time потока

---

#### 3. API proxy

```nginx
location /api/ {
    proxy_pass http://teltel:8080/api/;
    proxy_http_version 1.1;
    
    # Proxy заголовки
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Таймауты
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    proxy_connect_timeout 10s;
    
    # Буферизация для HTTP (включена по умолчанию)
    proxy_buffering on;
    
    # CORS заголовки НЕ нужны (единый origin)
    # Но можно оставить для обратной совместимости, если нужно
}
```

**Описание:**  
Проксирует все HTTP API запросы к backend. Обрабатывает все endpoints, начинающиеся с `/api/`.

**Приоритет:** Высокий (префиксный блок)

**Важные настройки:**
- `proxy_pass` с trailing slash — сохраняет путь `/api/...` при проксировании
- Стандартные proxy заголовки для корректной работы backend
- CORS заголовки не нужны (единый origin), но можно оставить для совместимости

**Обрабатываемые endpoints:**
- `/api/ingest`
- `/api/runs`
- `/api/run`
- `/api/health`
- `/api/analysis/*` (все analysis endpoints)

---

#### 4. config.js (runtime конфигурация)

```nginx
location = /config.js {
    expires -1;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
}
```

**Описание:**  
Статический файл `config.js` генерируется в runtime через `docker-entrypoint.sh`. После миграции на относительные пути этот файл может стать не нужен, но пока оставляем для обратной совместимости.

**Приоритет:** Высший (точное совпадение)

**Примечание:** После полной миграции на относительные пути этот блок можно будет удалить вместе с `docker-entrypoint.sh`.

---

#### 5. Статические ресурсы (JS, CSS, изображения)

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}
```

**Описание:**  
Кэширование статических ресурсов React build. Остаётся без изменений.

**Приоритет:** Средний (регулярное выражение)

**Изменение:** Добавлен `try_files $uri =404;` для явной обработки отсутствующих файлов.

---

#### 6. SPA routing (fallback на index.html)

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Описание:**  
Fallback для SPA routing. Все запросы, которые не соответствуют другим location blocks, направляются на `index.html`.

**Приоритет:** Низший (префиксный блок по умолчанию)

**Важно:** Этот блок должен быть последним, чтобы не перехватывать `/api/` и `/ws`.

---

## Полная конфигурация nginx

### Базовая конфигурация

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ============================================
    # Health check endpoint (nginx container)
    # ============================================
    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # ============================================
    # WebSocket proxy
    # ============================================
    location /ws {
        proxy_pass http://teltel:8080/ws;
        proxy_http_version 1.1;
        
        # WebSocket upgrade заголовки
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Proxy заголовки
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты для long-lived connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
        
        # Отключаем буферизацию для WebSocket
        proxy_buffering off;
    }

    # ============================================
    # API proxy
    # ============================================
    location /api/ {
        proxy_pass http://teltel:8080/api/;
        proxy_http_version 1.1;
        
        # Proxy заголовки
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_connect_timeout 10s;
        
        # Буферизация для HTTP
        proxy_buffering on;
    }

    # ============================================
    # config.js (runtime конфигурация)
    # ============================================
    location = /config.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }

    # ============================================
    # Статические ресурсы с кэшированием
    # ============================================
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ============================================
    # SPA routing (fallback на index.html)
    # ============================================
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Обработка edge cases

### 1. Конфликт маршрутов

**Проблема:** `/api/health` может конфликтовать с `/health`

**Решение:**  
- `/health` — точное совпадение (`location = /health`) для healthcheck nginx контейнера
- `/api/health` — обрабатывается через `location /api/` и проксируется к backend

**Порядок проверки:**
1. `location = /health` → nginx healthcheck
2. `location /api/` → backend `/api/health`

---

### 2. Статические файлы в `/api/`

**Проблема:** Если в будущем появятся статические файлы типа `/api/static/file.json`, они будут проксироваться к backend.

**Решение:**  
Это ожидаемое поведение. Все запросы к `/api/*` должны проксироваться к backend. Если нужны статические файлы, они должны быть вне `/api/`.

---

### 3. WebSocket upgrade failure

**Проблема:** Если backend недоступен, WebSocket upgrade может завершиться ошибкой.

**Решение:**  
- `proxy_connect_timeout 60s` — ограничивает время ожидания подключения
- Браузер получит ошибку подключения, которую можно обработать в клиенте
- Healthcheck контейнера проверит доступность backend через `depends_on`

---

### 4. Длинные запросы (ingest)

**Проблема:** `/api/ingest` может принимать длинные NDJSON потоки.

**Решение:**  
- `proxy_read_timeout 60s` — достаточно для большинства запросов
- Если нужны более длинные таймауты, можно увеличить для конкретного endpoint:
  ```nginx
  location /api/ingest {
      proxy_pass http://teltel:8080/api/ingest;
      proxy_read_timeout 300s;  # 5 минут для длинных потоков
      # ... остальные настройки
  }
  ```
- Но пока используем общий таймаут 60s, так как это должно быть достаточно

---

### 5. Относительные пути в статических файлах

**Проблема:** React build может содержать абсолютные пути к ресурсам.

**Решение:**  
Это не проблема для nginx proxy. Статические ресурсы (JS, CSS) загружаются относительно текущего origin (`localhost:3000`), что корректно работает с proxy.

---

## Сетевая архитектура

### Docker сеть

```
┌─────────────────────────────────────────┐
│  Docker Network: teltel-network        │
│                                         │
│  ┌──────────────┐      ┌─────────────┐ │
│  │  live-ui     │      │   teltel    │ │
│  │  nginx:80    │─────▶│   :8080     │ │
│  │              │      │             │ │
│  │  proxy_pass  │      │  backend    │ │
│  └──────────────┘      └─────────────┘ │
│       │                                 │
│       │ :3000 (host)                    │
└───────┼─────────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │ Browser │
   └─────────┘
```

### Поток запросов

#### HTTP API запрос

```
Browser → localhost:3000/api/runs
    ↓
nginx (live-ui) → proxy_pass → http://teltel:8080/api/runs
    ↓
teltel backend → обработка → JSON response
    ↓
nginx → Browser (JSON response)
```

#### WebSocket подключение

```
Browser → localhost:3000/ws (WebSocket upgrade)
    ↓
nginx (live-ui) → proxy_pass → ws://teltel:8080/ws
    ↓
teltel backend → WebSocket upgrade → connection established
    ↓
Browser ↔ teltel (через nginx proxy, bidirectional)
```

---

## Тестирование конфигурации

### Проверка синтаксиса

```bash
nginx -t -c /etc/nginx/conf.d/default.conf
```

### Проверка маршрутизации

1. **Health check:**
   ```bash
   curl http://localhost:3000/health
   # Ожидается: "healthy\n"
   ```

2. **Backend health через proxy:**
   ```bash
   curl http://localhost:3000/api/health
   # Ожидается: {"status":"ok"}
   ```

3. **API endpoint:**
   ```bash
   curl http://localhost:3000/api/runs
   # Ожидается: JSON массив run'ов
   ```

4. **WebSocket (через браузер или wscat):**
   ```bash
   wscat -c ws://localhost:3000/ws
   # Ожидается: успешное подключение
   ```

### Проверка заголовков

```bash
curl -v http://localhost:3000/api/health
```

Проверить наличие:
- `X-Real-IP` (должен быть IP клиента)
- `X-Forwarded-For` (должен содержать цепочку прокси)
- `Host` (должен быть `localhost:3000`)

---

## Риски и меры снижения

### Риск 1: Неправильная настройка WebSocket upgrade

**Вероятность:** Средняя  
**Влияние:** Высокое

**Меры снижения:**
- Использовать стандартные nginx директивы для WebSocket
- Тестировать WebSocket подключение после каждого изменения
- Документировать конфигурацию с примерами
- Проверить таймауты для long-lived connections

### Риск 2: Конфликт маршрутов

**Вероятность:** Низкая  
**Влияние:** Среднее

**Меры снижения:**
- Чёткий порядок location blocks (более специфичные первыми)
- Тестирование всех endpoints после изменений
- Документирование приоритетов маршрутизации

### Риск 3: Проблемы с таймаутами

**Вероятность:** Низкая  
**Влияние:** Среднее

**Меры снижения:**
- Настроить разумные таймауты (60s для HTTP, 3600s для WebSocket)
- Мониторить логи nginx на предмет таймаутов
- При необходимости увеличить таймауты для конкретных endpoints

---

## Следующие шаги

После завершения проектирования:

1. ✅ **Этап 2 завершён** — проектирование nginx proxy конфигурации
2. ⏭️ **Этап 3** — План Docker-интеграции nginx
3. ⏭️ **Этап 4** — План миграции Live UI HTTP клиента на относительные пути
4. ⏭️ **Этап 5** — План миграции WebSocket на относительный URL

---

## Приложение: Сравнение AS-IS и TO-BE

### AS-IS (текущая конфигурация)

```nginx
# Только статика, нет proxy
location / {
    try_files $uri $uri/ /index.html;
}
```

**Проблемы:**
- Браузер обращается напрямую к `localhost:8081`
- CORS проблемы
- Разные origin

### TO-BE (целевая конфигурация)

```nginx
# Proxy для API и WebSocket
location /api/ {
    proxy_pass http://teltel:8080/api/;
    # ... proxy настройки
}

location /ws {
    proxy_pass http://teltel:8080/ws;
    # ... WebSocket настройки
}
```

**Преимущества:**
- Единый origin (`localhost:3000`)
- Нет CORS проблем
- nginx как единая точка входа

---

**Статус:** ✅ Проектирование завершено  
**Готовность к реализации:** ✅ Да  
**Требуется утверждение:** ⏳ Ожидается
