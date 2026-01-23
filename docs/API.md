# API Reference

Документация всех API endpoints проекта teltel.

## Web UI

### Live UI v2
- **URL:** `http://localhost:3000` (отдельный сервис в Docker)
- **Описание:** Единственный пользовательский интерфейс проекта для наблюдения за телеметрией в реальном времени
- **Примечание:** Live UI v2 запускается как отдельный сервис в Docker. Подробнее см. [DOCKER.md](../DOCKER.md)
- **Важно:** Legacy UI (web/) удалён. Все функции доступны в Live UI v2 на http://localhost:3000

---

## Ingest API (Phase 1)

### POST /api/ingest

Приём телеметрических данных от внешних приложений (движков, симуляторов, тестовых стендов).

**Content-Type:** `application/x-ndjson`

**Формат:** Каждое событие — одна строка JSON (NDJSON stream)

**Принципы:**
- Best-effort доставка (без гарантий)
- События отправляются последовательно, без ожидания ответа
- Ошибки доставки не должны влиять на движок

**Типовой жизненный цикл:**
1. Движок открывает HTTP-соединение с `/api/ingest`
2. Отправляет событие `run.start`
3. Отправляет события `telemetry` (обычно по кадрам)
4. Отправляет событие `run.end`
5. Соединение закрывается

**Подробнее:** [docs/05-ingest-and-storage.md](05-ingest-and-storage.md)

### GET /api/health

Проверка состояния сервиса.

**Response:** Статус сервиса

---

## Live API (Phase 1)

### GET /api/runs

Список активных run'ов.

**Response:** Список run'ов с метаданными

### GET /api/run

Метаданные конкретного run'а.

**Query params:**
- `runId` (обязательно): идентификатор run'а

**Response:** Метаданные run'а

### WS /ws

WebSocket подключение для получения live-потока телеметрических событий.

**Использование:** Live UI подключается к этому endpoint для получения данных в реальном времени.

**Подробнее:** [WEBSOCKET_API_CONTRACT.md](WEBSOCKET_API_CONTRACT.md)

---

## Analysis API (Phase 3)

Analysis API предоставляет доступ к историческим данным из ClickHouse. Все endpoints используют только SELECT запросы и не содержат аналитической логики.

### GET /api/analysis/runs

Список завершённых run'ов.

**Query params:**
- `sourceId` (опционально): фильтр по source_id
- `status` (опционально): фильтр по статусу
- `daysBack` (опционально, по умолчанию 30): количество дней назад

**Response:** JSONEachRow с полями:
- `run_id`
- `started_at`
- `ended_at`
- `status`
- `total_events`
- `total_frames`
- `engine_version`
- `source_id`

**Пример:**
```bash
curl "http://localhost:8080/api/analysis/runs?sourceId=flight-engine&daysBack=7"
```

### GET /api/analysis/run/{runId}

Метаданные конкретного run'а.

**Path params:**
- `runId` (обязательно): идентификатор run'а

**Response:** JSONEachRow с полями:
- `run_id`
- `started_at`
- `ended_at`
- `duration_seconds`
- `status`
- `total_events`
- `total_frames`
- `max_frame_index`
- `source_id`
- `config`
- `engine_version`
- `seed`
- `end_reason`
- `tags`

**Пример:**
```bash
curl "http://localhost:8080/api/analysis/run/run-123"
```

### GET /api/analysis/series

Временной ряд для run'а.

**Query params:**
- `runId` (обязательно): идентификатор run'а
- `eventType` (обязательно): тип события (например, `telemetry`, `body.state`)
- `sourceId` (обязательно): идентификатор источника
- `jsonPath` (обязательно): JSONPath к значению в payload (например, `pos.x`, `altitude`)

**Response:** JSONEachRow с полями:
- `frame_index`
- `sim_time`
- `value`

**Пример:**
```bash
curl "http://localhost:8080/api/analysis/series?runId=run-123&eventType=body.state&sourceId=drive-engine&jsonPath=pos.x"
```

### GET /api/analysis/compare

Сравнение двух run'ов.

**Query params:**
- `runId1` (обязательно): идентификатор первого run'а
- `runId2` (обязательно): идентификатор второго run'а
- `eventType` (обязательно): тип события
- `sourceId` (обязательно): идентификатор источника
- `jsonPath` (обязательно): JSONPath к значению в payload

**Response:** JSONEachRow с полями:
- `frame_index`
- `sim_time_1`
- `sim_time_2`
- `value_1`
- `value_2`
- `diff` (разница между значениями)

**Пример:**
```bash
curl "http://localhost:8080/api/analysis/compare?runId1=run-123&runId2=run-456&eventType=body.state&sourceId=drive-engine&jsonPath=pos.x"
```

### POST /api/analysis/query

Выполнение произвольного SELECT запроса к ClickHouse.

**Body:**
```json
{
  "query": "SELECT ... FROM ... WHERE ..."
}
```

**Response:** JSONEachRow с результатами запроса

**Ограничение:** Принимает только SELECT запросы (проверка по префиксу). INSERT/UPDATE/DELETE не допускаются.

**Пример:**
```bash
curl -X POST http://localhost:8080/api/analysis/query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT run_id, started_at FROM runs WHERE source_id = '\''flight-engine'\'' LIMIT 10"}'
```

**Подробнее:** [docs/12-phase3-cursor-examples.md](12-phase3-cursor-examples.md)

---

## Примечания

- Все endpoints возвращают данные в формате JSONEachRow (ClickHouse формат)
- Analysis API использует только SELECT запросы к ClickHouse
- Analysis API не содержит аналитической логики — только передача данных
- WebSocket API используется для live-потока данных в реальном времени
- Ingest API использует NDJSON stream для приёма телеметрии

**Архитектурные контракты:**
- Phase 1 API зафиксированы: [PHASE1_FREEZE.md](PHASE1_FREEZE.md)
- Phase 2 API зафиксированы: [PHASE2_FREEZE.md](PHASE2_FREEZE.md)
- Phase 3 API зафиксированы: [PHASE3_FREEZE.md](PHASE3_FREEZE.md)
