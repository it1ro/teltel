# Руководство по Engineering Validation

Это краткое руководство по запуску Engineering Validation для teltel v0.3.0.

---

## Подготовка

### 1. Зафиксировать baseline

```bash
git log -1 --pretty=format:"%H %s"
# Должен быть: 527e6263ad2212c0950fc65c66bc6bc093c3ed35
```

### 2. Запустить ClickHouse (опционально, для полной валидации)

```bash
# Если ClickHouse установлен локально
clickhouse-server

# Или через Docker
docker run -d -p 8123:8123 -p 9000:9000 clickhouse/clickhouse-server
```

### 3. Запустить teltel в полной конфигурации

```bash
go run cmd/teltel/main.go \
  -clickhouse-url=http://localhost:8123 \
  -batcher-enabled=true \
  -batcher-batch-size=10000 \
  -batcher-flush-interval=500ms
```

---

## Docker окружение

Для воспроизводимости валидации можно использовать dockerized окружение.

### Запуск через Docker Compose

**Запуск полного стека:**
```bash
make docker-up
# Или:
docker-compose up -d
```

Это запустит:
- teltel на http://localhost:8081
- ClickHouse на http://localhost:8123

**Остановка стека:**
```bash
make docker-down
# Или:
docker-compose down
```

### Валидация в Docker окружении

Все скрипты валидации поддерживают переменные окружения для работы с dockerized стеком:

```bash
# Базовая валидация против dockerized стека
make validate-docker

# Или вручную с переменными окружения:
TELTEL_BASE_URL=http://localhost:8080 CLICKHOUSE_URL=http://localhost:8123 ./scripts/validate.sh
```

**Нагрузочное тестирование в Docker:**
```bash
# Все скрипты автоматически используют переменные окружения
TELTEL_BASE_URL=http://localhost:8080 ./scripts/load_test.sh 10000 60
TELTEL_BASE_URL=http://localhost:8080 ./scripts/burst_test.sh 1000 50000 10 60
TELTEL_BASE_URL=http://localhost:8080 ./scripts/multi_run_test.sh 10 1000 60
```

**Просмотр логов:**
```bash
make docker-logs
# Или:
docker-compose logs -f teltel
docker-compose logs -f clickhouse
```

### Различия между локальным и dockerized режимом

**Локальный режим:**
- teltel запускается через `go run` или собранный бинарь
- ClickHouse должен быть запущен отдельно (локально или в Docker)
- Скрипты валидации используют значения по умолчанию (`http://localhost:8080`)

**Docker режим:**
- Весь стек (teltel + ClickHouse) запускается через docker-compose
- Автоматическая конфигурация через environment variables
- Health checks обеспечивают готовность сервисов перед запуском
- Персистентное хранилище ClickHouse в `./data/clickhouse`

**Поведение валидации:**
- Одинаковое в обоих режимах
- Скрипты автоматически определяют окружение через переменные `TELTEL_BASE_URL` и `CLICKHOUSE_URL`
- Можно легко переключаться между режимами

---

## Выполнение валидации

### Базовая валидация компонентов

```bash
./scripts/validate.sh
```

Проверяет:
- Health endpoint
- Ingest endpoint
- Live API
- Analysis API (если ClickHouse доступен)
- Изоляцию компонентов
- Обработку некорректных событий

### Валидация Cursor workflow

```bash
./scripts/validate_cursor_workflow.sh
```

Проверяет:
- Детерминированность SQL запросов
- Корректность SQL helpers
- Защиту от не-SELECT запросов

### Нагрузочное тестирование

**Высокая частота событий:**
```bash
./scripts/load_test.sh 10000 60
# 10000 событий/сек в течение 60 секунд
```

**Burst-нагрузки:**
```bash
./scripts/burst_test.sh 1000 50000 10 60
# Норма: 1000/сек, Burst: 50000/сек на 10 сек каждые 60 сек
```

**Множественные run'ы:**
```bash
./scripts/multi_run_test.sh 10 1000 60
# 10 одновременных run'ов, 1000 событий/сек на run, 60 секунд
```

---

## Ручная валидация

### 1. Валидация live-пути (Phase 1)

**Проверка ingest:**
```bash
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/x-ndjson" \
  -d '{"v":1,"runId":"test","sourceId":"test","channel":"test","type":"test","frameIndex":0,"simTime":0.0,"payload":{}}'
```

**Проверка Live API:**
```bash
curl http://localhost:8080/api/runs
curl "http://localhost:8080/api/run?runId=test"
```

**Проверка WebSocket:**
- Откройте http://localhost:8080 в браузере
- Проверьте, что графики обновляются

### 2. Валидация storage-пути (Phase 2)

**Проверка Batcher:**
- Отправьте события через ingest
- Проверьте логи сервера на наличие сообщений о flush
- Проверьте ClickHouse:
  ```sql
  SELECT COUNT(*) FROM telemetry_events;
  SELECT * FROM run_metadata ORDER BY started_at DESC LIMIT 5;
  ```

**Проверка деградации:**
- Остановите ClickHouse
- Убедитесь, что live-поток продолжает работать
- Убедитесь, что ingest не блокируется
- Проверьте логи на ошибки batcher'а

### 3. Валидация analysis-пути (Phase 3)

**Проверка Analysis API:**
```bash
curl http://localhost:8080/api/analysis/runs
curl http://localhost:8080/api/analysis/run/{runId}
curl "http://localhost:8080/api/analysis/series?runId=...&eventType=...&sourceId=...&jsonPath=..."
```

**Проверка POST /api/analysis/query:**
```bash
# Должен работать
curl -X POST http://localhost:8080/api/analysis/query \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT 1"}'

# Должен быть отклонён
curl -X POST http://localhost:8080/api/analysis/query \
  -H "Content-Type: application/json" \
  -d '{"query":"INSERT INTO test VALUES (1)"}'
```

### 4. Валидация UI

**Live UI:**
- Откройте http://localhost:8080
- Убедитесь, что графики отображаются
- Проверьте, что данные обновляются в реальном времени

**Post-run Analysis UI:**
- Откройте http://localhost:8080/analysis.html
- Убедитесь, что список run'ов загружается
- Проверьте, что SQL запросы видны и копируемы

### 5. Валидация изоляции компонентов

**Тест 1: Падение ClickHouse**
- Остановите ClickHouse
- Убедитесь, что live-графики продолжают работать
- Убедитесь, что ingest принимает события

**Тест 2: Медленный batcher**
- Замедлите ClickHouse (если возможно)
- Убедитесь, что WebSocket клиенты не блокируются
- Убедитесь, что ingest не блокируется

---

## Фиксация результатов

Все результаты должны быть зафиксированы в:
- `docs/ENGINEERING_VALIDATION_RESULTS.md`

Включайте:
- Наблюдаемое поведение
- Пределы производительности
- Точки деградации
- Known limitations

---

## Связанные документы

- `docs/10-engineering-validation.md` — полное описание Engineering Validation
- `docs/ENGINEERING_VALIDATION_RESULTS.md` — результаты валидации
- `docs/08-failure-modes.md` — описание failure modes
- `docs/02-architecture.md` — архитектура системы
