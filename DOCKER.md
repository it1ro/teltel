# Docker окружение для teltel

Этот документ описывает использование Docker окружения для teltel.

## Быстрый старт

### Запуск полного стека

```bash
make docker-up
```

Это запустит:
- **live-ui** (Live UI v2) на http://localhost:3000 (единственный пользовательский интерфейс, единая точка входа)
- **teltel** (backend) доступен через nginx proxy на http://localhost:3000/api/* (только внутри Docker сети)
- **ClickHouse** на http://localhost:8123

### Остановка стека

```bash
make docker-down
```

### Просмотр логов

```bash
make docker-logs
# Или для конкретного сервиса:
docker-compose logs -f teltel
docker-compose logs -f clickhouse
docker-compose logs -f live-ui
```

## Структура Docker окружения

### Файлы

- `Dockerfile` - multi-stage build для teltel (alpine-based)
- `live-ui/Dockerfile` - multi-stage build для Live UI (Node.js build + nginx serve)
- `docker-compose.yml` - конфигурация стека (teltel + ClickHouse + live-ui)
- `docker-entrypoint.sh` - entrypoint скрипт для преобразования ENV в флаги
- `.dockerignore` - исключения для Docker build

### Сервисы

#### teltel

- **Порт:** 8080 (только внутренний, недоступен извне)
- **Образ:** собирается из `Dockerfile`
- **Health check:** `GET /api/health` каждые 10 секунд
- **Зависимости:** ожидает готовности ClickHouse
- **Примечание:** Backend предоставляет только API и WebSocket endpoints. Доступен только внутри Docker сети через `http://teltel:8080`. Внешний доступ к API осуществляется через nginx proxy в live-ui на `http://localhost:3000/api/*`.

#### clickhouse

- **Порты:** 8123 (HTTP), 9000 (Native)
- **Образ:** `clickhouse/clickhouse-server:latest`
- **Health check:** `GET /ping` каждые 10 секунд
- **Volumes:** `./data/clickhouse` для персистентности данных

#### live-ui

- **Порт:** 3000 (внешний) -> 80 (внутренний)
- **Образ:** собирается из `live-ui/Dockerfile`
- **Health check:** `GET /health` каждые 10 секунд
- **Зависимости:** ожидает готовности teltel
- **Примечание:** Live UI v2 является единственным пользовательским интерфейсом проекта. Legacy UI (web/) удалён. nginx в live-ui контейнере работает как единая точка входа для браузера:
  - `/` → React Build (статический контент)
  - `/api/*` → proxy_pass → `http://teltel:8080/api/*`
  - `/ws` → proxy_pass → `ws://teltel:8080/ws` (WebSocket upgrade)

## Конфигурация через переменные окружения

teltel контейнер поддерживает следующие переменные окружения:

- `TELTEL_HTTP_PORT` - порт HTTP сервера (по умолчанию 8080)
- `TELTEL_CLICKHOUSE_URL` - URL ClickHouse (по умолчанию `http://clickhouse:8123`)
- `TELTEL_BATCHER_ENABLED` - включить Batcher (по умолчанию `true` в docker-compose)
- `TELTEL_BATCHER_BATCH_SIZE` - размер батча (по умолчанию 10000)
- `TELTEL_BATCHER_FLUSH_INTERVAL` - интервал flush (по умолчанию 500ms)
- `TELTEL_BUFFER_CAPACITY` - размер ring buffer (по умолчанию 10000)
- `TELTEL_BUFFER_MAX_RUNS` - максимальное количество run'ов (по умолчанию 0 = без ограничений)
- `TELTEL_BUFFER_CLEANUP_INTERVAL` - интервал очистки (по умолчанию 5m)

Переменные автоматически преобразуются в флаги командной строки через `docker-entrypoint.sh`.

#### live-ui

Live UI использует относительные пути для подключения к backend через nginx proxy:
- WebSocket: `/ws` (проксируется к `ws://teltel:8080/ws`)
- HTTP API: `/api/*` (проксируется к `http://teltel:8080/api/*`)

**Архитектура nginx proxy:**
- nginx работает как единая точка входа для браузера
- Все запросы идут через `http://localhost:3000` (единый origin, нет CORS проблем)
- Backend доступен только внутри Docker сети через `http://teltel:8080`

**Примечание:** После миграции на относительные пути (Этапы 4-5 roadmap) runtime конфигурация через `VITE_WS_URL` больше не требуется.

## Валидация в Docker окружении

### Базовая валидация

```bash
make validate-docker
```

### Валидация Cursor workflow

```bash
TELTEL_BASE_URL=http://localhost:3000/api CLICKHOUSE_URL=http://localhost:8123 ./scripts/validate_cursor_workflow.sh
```

### Нагрузочное тестирование

```bash
TELTEL_BASE_URL=http://localhost:3000/api ./scripts/load_test.sh 10000 60
TELTEL_BASE_URL=http://localhost:3000/api ./scripts/burst_test.sh 1000 50000 10 60
TELTEL_BASE_URL=http://localhost:3000/api ./scripts/multi_run_test.sh 10 1000 60
```

## Отладка

### Shell в контейнере teltel

```bash
make docker-shell
# Или:
docker-compose exec teltel /bin/sh
```

### Проверка логов

```bash
# Все сервисы
docker-compose logs -f

# Только teltel
docker-compose logs -f teltel

# Только ClickHouse
docker-compose logs -f clickhouse

# Только Live UI
docker-compose logs -f live-ui
```

### Проверка состояния

```bash
docker-compose ps
```

### Пересборка образа

```bash
make docker-build
# Или для конкретного сервиса:
docker-compose build --no-cache teltel
docker-compose build --no-cache live-ui
```

## Персистентность данных

Данные ClickHouse сохраняются в `./data/clickhouse` на хосте. При остановке и запуске стека данные сохраняются.

**Важно:** Директория `data/` добавлена в `.gitignore` и не коммитится в репозиторий.

## Сеть

Сервисы общаются через Docker сеть `teltel-network`. 
- teltel обращается к ClickHouse по имени сервиса: `http://clickhouse:8123`
- live-ui (nginx) проксирует запросы к teltel по внутреннему адресу: `http://teltel:8080`
- Браузер обращается только к `http://localhost:3000` (единая точка входа через nginx proxy)

## Очистка

### Остановка и удаление контейнеров

```bash
make docker-down
```

### Удаление данных ClickHouse

```bash
rm -rf ./data/clickhouse
```

### Удаление образов

```bash
docker rmi teltel:latest
docker rmi teltel-live-ui:latest
docker rmi clickhouse/clickhouse-server:latest
```

## Troubleshooting

### Порт 3000 уже занят

Измените порт в `docker-compose.yml`:

```yaml
live-ui:
  ports:
    - "3001:80"  # Используйте другой порт
```

### ClickHouse не запускается

Проверьте логи:
```bash
docker-compose logs clickhouse
```

Убедитесь, что порты 8123 и 9000 свободны.

### teltel не может подключиться к ClickHouse

Проверьте, что ClickHouse здоров:
```bash
docker-compose ps
```

Убедитесь, что `TELTEL_CLICKHOUSE_URL` установлен в `http://clickhouse:8123` (не `localhost`).

### Live UI не может подключиться к WebSocket

Проверьте, что:
1. Backend (teltel) запущен и здоров: `docker-compose ps`
2. nginx proxy настроен корректно (проверьте `live-ui/nginx.conf`)
3. WebSocket доступен через nginx proxy: `ws://localhost:3000/ws`
4. Откройте браузерную консоль для проверки ошибок подключения

### Live UI не отображается

Проверьте логи:
```bash
docker-compose logs live-ui
```

Убедитесь, что контейнер запущен и health check проходит:
```bash
docker-compose ps
curl http://localhost:3000/health
```

## Отличия от локального запуска

1. **Архитектура:** Docker использует nginx proxy в live-ui как единую точку входа (нет прямого доступа к backend из браузера)
2. **Порт:** Backend доступен только внутри Docker сети (порт 8080), внешний доступ через `http://localhost:3000/api/*`
3. **ClickHouse:** Автоматически запускается и настраивается
4. **Конфигурация:** Через ENV переменные вместо флагов
5. **Изоляция:** Полная изоляция окружения от хоста

## Примеры конфигураций docker-compose

### Базовая конфигурация (production)

```yaml
services:
  clickhouse:
    image: clickhouse/clickhouse-server:latest
    container_name: teltel-clickhouse
    ports:
      - "8123:8123"
    volumes:
      - ./data/clickhouse:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8123/ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - teltel-network

  teltel:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: teltel
    # Убран внешний порт - backend доступен только через nginx proxy
    # Внутренний адрес: http://teltel:8080 (для nginx proxy)
    # Внешний доступ: http://localhost:3000/api/* (через nginx proxy)
    environment:
      - TELTEL_HTTP_PORT=8080
      - TELTEL_CLICKHOUSE_URL=http://clickhouse:8123
      - TELTEL_BATCHER_ENABLED=true
    depends_on:
      clickhouse:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - teltel-network

  live-ui:
    build:
      context: ./live-ui
      dockerfile: Dockerfile
    container_name: teltel-live-ui
    ports:
      - "3000:80"
    # Убрана переменная VITE_WS_URL - используются относительные пути (/ws)
    # После миграции на относительные пути (Этапы 4, 5) runtime конфигурация не нужна
    depends_on:
      teltel:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - teltel-network

networks:
  teltel-network:
    driver: bridge
```

### Конфигурация с кастомными портами

```yaml
services:
  live-ui:
    # ... остальная конфигурация
    ports:
      - "4000:80"  # Кастомный внешний порт
    # Относительные пути работают с любым портом
    # WebSocket: ws://localhost:4000/ws
    # HTTP API: http://localhost:4000/api/*
```

### Конфигурация для разработки (с volume mounts)

```yaml
services:
  live-ui:
    build:
      context: ./live-ui
      dockerfile: Dockerfile
    container_name: teltel-live-ui-dev
    ports:
      - "3000:80"
    # Относительные пути работают без дополнительной конфигурации
    volumes:
      # Монтируем исходный код для разработки (требует пересборки)
      - ./live-ui/src:/app/src:ro
      - ./live-ui/public:/app/public:ro
    depends_on:
      teltel:
        condition: service_healthy
    networks:
      - teltel-network
```

**Примечание:** Volume mounts для разработки требуют пересборки образа или использования dev-режима локально. Для production используйте собранный образ.

### Конфигурация с несколькими окружениями

После миграции на относительные пути (Этапы 4-5) конфигурация через environment variables больше не требуется. Все запросы идут через относительные пути (`/api/*`, `/ws`), которые работают одинаково в любом окружении.

**Примечание:** Для разных окружений достаточно изменить только порт live-ui или доменное имя, относительные пути остаются неизменными.

## Интеграция с Makefile

Все основные операции доступны через Makefile:

- `make docker-build` - сборка образа
- `make docker-up` - запуск стека
- `make docker-down` - остановка стека
- `make docker-logs` - просмотр логов
- `make docker-shell` - shell в контейнере
- `make validate-docker` - валидация в Docker окружении

См. `make help` для полного списка команд.
