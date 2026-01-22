# Docker окружение для teltel

Этот документ описывает использование Docker окружения для teltel.

## Быстрый старт

### Запуск полного стека

```bash
make docker-up
```

Это запустит:
- **teltel** на http://localhost:8081
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
```

## Структура Docker окружения

### Файлы

- `Dockerfile` - multi-stage build для teltel (alpine-based)
- `docker-compose.yml` - конфигурация стека (teltel + ClickHouse)
- `docker-entrypoint.sh` - entrypoint скрипт для преобразования ENV в флаги
- `.dockerignore` - исключения для Docker build

### Сервисы

#### teltel

- **Порт:** 8081 (внешний) -> 8080 (внутренний)
- **Образ:** собирается из `Dockerfile`
- **Health check:** `GET /api/health` каждые 10 секунд
- **Зависимости:** ожидает готовности ClickHouse

#### clickhouse

- **Порты:** 8123 (HTTP), 9000 (Native)
- **Образ:** `clickhouse/clickhouse-server:latest`
- **Health check:** `GET /ping` каждые 10 секунд
- **Volumes:** `./data/clickhouse` для персистентности данных

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

## Валидация в Docker окружении

### Базовая валидация

```bash
make validate-docker
```

### Валидация Cursor workflow

```bash
TELTEL_BASE_URL=http://localhost:8081 CLICKHOUSE_URL=http://localhost:8123 ./scripts/validate_cursor_workflow.sh
```

### Нагрузочное тестирование

```bash
TELTEL_BASE_URL=http://localhost:8081 ./scripts/load_test.sh 10000 60
TELTEL_BASE_URL=http://localhost:8081 ./scripts/burst_test.sh 1000 50000 10 60
TELTEL_BASE_URL=http://localhost:8081 ./scripts/multi_run_test.sh 10 1000 60
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
```

### Проверка состояния

```bash
docker-compose ps
```

### Пересборка образа

```bash
make docker-build
# Или:
docker-compose build --no-cache teltel
```

## Персистентность данных

Данные ClickHouse сохраняются в `./data/clickhouse` на хосте. При остановке и запуске стека данные сохраняются.

**Важно:** Директория `data/` добавлена в `.gitignore` и не коммитится в репозиторий.

## Сеть

Сервисы общаются через Docker сеть `teltel-network`. teltel обращается к ClickHouse по имени сервиса: `http://clickhouse:8123`.

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
docker rmi clickhouse/clickhouse-server:latest
```

## Troubleshooting

### Порт 8081 уже занят

Измените порт в `docker-compose.yml`:

```yaml
ports:
  - "8082:8080"  # Используйте другой порт
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

## Отличия от локального запуска

1. **Порт:** Docker использует 8081 вместо 8080 (чтобы избежать конфликтов)
2. **ClickHouse:** Автоматически запускается и настраивается
3. **Конфигурация:** Через ENV переменные вместо флагов
4. **Изоляция:** Полная изоляция окружения от хоста

## Интеграция с Makefile

Все основные операции доступны через Makefile:

- `make docker-build` - сборка образа
- `make docker-up` - запуск стека
- `make docker-down` - остановка стека
- `make docker-logs` - просмотр логов
- `make docker-shell` - shell в контейнере
- `make validate-docker` - валидация в Docker окружении

См. `make help` для полного списка команд.
