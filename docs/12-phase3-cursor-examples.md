# Phase 3 — Cursor Examples

Этот документ содержит примеры reasoning для Cursor при работе с post-run анализом в teltel.

**Цель:** сделать анализ телеметрии воспроизводимым и понятным для Cursor.

---

## Принципы работы с Cursor

1. **SQL helpers — источник истины:** Все аналитические запросы используют SQL helpers из `internal/storage/sql_helpers.go`
2. **Воспроизводимость:** Каждый анализ можно повторить через SQL запрос
3. **Прозрачность:** SQL запросы всегда видны и копируемы
4. **Без магии:** UI не делает выводов, только показывает данные

---

## Пример 1: Извлечение временного ряда

### Задача
Извлечь временной ряд позиции по X для run'а `run-123`.

### Входные параметры
- `runId`: `"run-123"`
- `eventType`: `"body.state"`
- `sourceId`: `"drive-engine"`
- `jsonPath`: `"pos.x"`

### SQL запрос
```go
query := storage.GetSeriesQuery("run-123", "body.state", "drive-engine", "pos.x")
```

Результирующий SQL:
```sql
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'pos.x') AS value
FROM telemetry_events
WHERE run_id = 'run-123'
  AND type = 'body.state'
  AND source_id = 'drive-engine'
ORDER BY frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 0, "sim_time": 0.0, "value": 0.0}
{"frame_index": 1, "sim_time": 0.016, "value": 0.1}
{"frame_index": 2, "sim_time": 0.032, "value": 0.2}
...
```

### Использование через API
```bash
GET /api/analysis/series?runId=run-123&eventType=body.state&sourceId=drive-engine&jsonPath=pos.x
```

### Reasoning для Cursor
> "Извлеки временной ряд позиции X для run-123. Используй SQL helper GetSeriesQuery с параметрами: runId='run-123', eventType='body.state', sourceId='drive-engine', jsonPath='pos.x'. Результат будет в формате JSONEachRow с полями frame_index, sim_time, value."

---

## Пример 2: Поиск аномалий (выбросы)

### Задача
Найти кадры с аномальными значениями slipRatio (вне диапазона [-1.0, 2.0]).

### Входные параметры
- `runId`: `"run-123"`
- `eventType`: `"wheel.force"`
- `jsonPath`: `"slipRatio"`
- `minValue`: `-1.0`
- `maxValue`: `2.0`

### SQL запрос
```go
query := storage.GetOutliersQuery("run-123", "wheel.force", "slipRatio", -1.0, 2.0)
```

Результирующий SQL:
```sql
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'slipRatio') AS value
FROM telemetry_events
WHERE run_id = 'run-123'
  AND type = 'wheel.force'
  AND (
    JSONExtractFloat(payload, 'slipRatio') > 2.0
    OR JSONExtractFloat(payload, 'slipRatio') < -1.0
  )
ORDER BY frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 1840, "sim_time": 29.44, "value": 2.5}
{"frame_index": 1841, "sim_time": 29.456, "value": 2.3}
...
```

### Использование через API
```bash
POST /api/analysis/query
Body: {"query": "SELECT frame_index, sim_time, JSONExtractFloat(payload, 'slipRatio') AS value FROM telemetry_events WHERE run_id = 'run-123' AND type = 'wheel.force' AND (JSONExtractFloat(payload, 'slipRatio') > 2.0 OR JSONExtractFloat(payload, 'slipRatio') < -1.0) ORDER BY frame_index;"}
```

### Reasoning для Cursor
> "Найди аномальные значения slipRatio в run-123. Используй GetOutliersQuery с параметрами: runId='run-123', eventType='wheel.force', jsonPath='slipRatio', minValue=-1.0, maxValue=2.0. Результат содержит кадры, где slipRatio выходит за допустимые границы."

---

## Пример 3: Поиск скачков (spikes)

### Задача
Найти резкие изменения скорости по X между кадрами (порог > 10.0).

### Входные параметры
- `runId`: `"run-123"`
- `eventType`: `"body.state"`
- `jsonPath`: `"vel.x"`
- `threshold`: `10.0`

### SQL запрос
```go
query := storage.GetSpikesQuery("run-123", "body.state", "vel.x", 10.0)
```

Результирующий SQL:
```sql
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, 'vel.x') AS value,
    lag(JSONExtractFloat(payload, 'vel.x')) OVER (
      PARTITION BY run_id ORDER BY frame_index
    ) AS prev_value
  FROM telemetry_events
  WHERE run_id = 'run-123'
    AND type = 'body.state'
)
SELECT
  frame_index,
  value,
  prev_value,
  abs(value - prev_value) AS delta
FROM series
WHERE abs(value - prev_value) > 10.0
ORDER BY frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 500, "value": 15.0, "prev_value": 4.0, "delta": 11.0}
{"frame_index": 501, "value": 16.0, "prev_value": 15.0, "delta": 1.0}
...
```

### Reasoning для Cursor
> "Найди резкие скачки скорости X в run-123. Используй GetSpikesQuery с параметрами: runId='run-123', eventType='body.state', jsonPath='vel.x', threshold=10.0. Результат показывает кадры, где изменение между соседними кадрами превышает порог."

---

## Пример 4: Сравнение двух run'ов

### Задача
Сравнить позицию X между run-123 и run-456.

### Входные параметры
- `runId1`: `"run-123"`
- `runId2`: `"run-456"`
- `eventType`: `"body.state"`
- `sourceId`: `"drive-engine"`
- `jsonPath`: `"pos.x"`

### SQL запрос
```go
query := storage.GetCompareRunsQuery("run-123", "run-456", "body.state", "drive-engine", "pos.x")
```

Результирующий SQL:
```sql
SELECT
  r1.frame_index,
  r1.sim_time AS sim_time_1,
  r2.sim_time AS sim_time_2,
  JSONExtractFloat(r1.payload, 'pos.x') AS value_1,
  JSONExtractFloat(r2.payload, 'pos.x') AS value_2,
  JSONExtractFloat(r2.payload, 'pos.x') - JSONExtractFloat(r1.payload, 'pos.x') AS diff
FROM telemetry_events AS r1
INNER JOIN telemetry_events AS r2
  ON r1.frame_index = r2.frame_index
WHERE r1.run_id = 'run-123'
  AND r2.run_id = 'run-456'
  AND r1.type = 'body.state'
  AND r2.type = 'body.state'
  AND r1.source_id = 'drive-engine'
  AND r2.source_id = 'drive-engine'
ORDER BY r1.frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 0, "sim_time_1": 0.0, "sim_time_2": 0.0, "value_1": 0.0, "value_2": 0.0, "diff": 0.0}
{"frame_index": 1, "sim_time_1": 0.016, "sim_time_2": 0.016, "value_1": 0.1, "value_2": 0.12, "diff": 0.02}
...
```

### Использование через API
```bash
GET /api/analysis/compare?runId1=run-123&runId2=run-456&eventType=body.state&sourceId=drive-engine&jsonPath=pos.x
```

### Reasoning для Cursor
> "Сравни позицию X между run-123 и run-456. Используй GetCompareRunsQuery с параметрами: runId1='run-123', runId2='run-456', eventType='body.state', sourceId='drive-engine', jsonPath='pos.x'. Результат содержит значения для обоих run'ов и их разницу по каждому кадру."

---

## Пример 5: Поиск NaN значений

### Задача
Найти кадры с некорректными числовыми значениями (NaN или Inf) в позиции X.

### Входные параметры
- `runId`: `"run-123"`
- `eventType`: `"body.state"`
- `jsonPath`: `"pos.x"`

### SQL запрос
```go
query := storage.GetNaNQuery("run-123", "body.state", "pos.x")
```

Результирующий SQL:
```sql
SELECT
  frame_index,
  sim_time,
  type,
  payload
FROM telemetry_events
WHERE run_id = 'run-123'
  AND type = 'body.state'
  AND (
    isNaN(JSONExtractFloat(payload, 'pos.x'))
    OR isInfinite(JSONExtractFloat(payload, 'pos.x'))
  )
ORDER BY frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 1000, "sim_time": 16.0, "type": "body.state", "payload": "{\"pos\":{\"x\":\"NaN\"}}"}
...
```

### Reasoning для Cursor
> "Найди кадры с NaN или Inf значениями в pos.x для run-123. Используй GetNaNQuery с параметрами: runId='run-123', eventType='body.state', jsonPath='pos.x'. Результат содержит полные события с некорректными значениями."

---

## Пример 6: Агрегаты по кадрам

### Задача
Получить статистику по количеству событий каждого типа в каждом кадре.

### Входные параметры
- `runId`: `"run-123"`

### SQL запрос
```go
query := storage.GetFrameAggregatesQuery("run-123")
```

Результирующий SQL:
```sql
SELECT
  run_id,
  frame_index,
  type,
  count() AS events_count
FROM telemetry_events
WHERE run_id = 'run-123'
GROUP BY run_id, frame_index, type
ORDER BY frame_index, type;
```

### Ожидаемый shape результата
```json
{"run_id": "run-123", "frame_index": 0, "type": "body.state", "events_count": 1}
{"run_id": "run-123", "frame_index": 0, "type": "frame.end", "events_count": 1}
{"run_id": "run-123", "frame_index": 1, "type": "body.state", "events_count": 1}
...
```

### Reasoning для Cursor
> "Получи агрегаты по кадрам для run-123. Используй GetFrameAggregatesQuery с параметром runId='run-123'. Результат показывает количество событий каждого типа в каждом кадре."

---

## Пример 7: Корреляционный анализ

### Задача
Найти корреляцию между углом атаки (aoa) и коэффициентом подъёмной силы (cl).

### Входные параметры
- `runId`: `"run-123"`
- `eventType`: `"aero.state"`
- `sourceId`: `"flight-engine"`
- `jsonPath1`: `"aoa"`
- `jsonPath2`: `"cl"`

### SQL запрос
```go
query := storage.GetCorrelationQuery("run-123", "aero.state", "flight-engine", "aoa", "cl")
```

Результирующий SQL:
```sql
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, 'aoa') AS value1,
    JSONExtractFloat(payload, 'cl') AS value2
  FROM telemetry_events
  WHERE run_id = 'run-123'
    AND type = 'aero.state'
    AND source_id = 'flight-engine'
)
SELECT
  frame_index,
  value1,
  value2,
  value1 * value2 AS product
FROM series
WHERE value1 IS NOT NULL AND value2 IS NOT NULL
ORDER BY frame_index;
```

### Ожидаемый shape результата
```json
{"frame_index": 0, "value1": 0.1, "value2": 0.5, "product": 0.05}
{"frame_index": 1, "value1": 0.12, "value2": 0.52, "product": 0.0624}
...
```

### Reasoning для Cursor
> "Найди корреляцию между aoa и cl для run-123. Используй GetCorrelationQuery с параметрами: runId='run-123', eventType='aero.state', sourceId='flight-engine', jsonPath1='aoa', jsonPath2='cl'. Результат содержит оба значения и их произведение для каждого кадра."

---

## Типовые инженерные запросы для Cursor

### Запрос 1: "Найди проблемный кадр"
```
В run-123 наблюдается резкий рывок при выходе из поворота.
Найди кадры с аномальными значениями slipRatio и резкими скачками скорости.
```

**Действия Cursor:**
1. Использовать GetOutliersQuery для поиска аномальных slipRatio
2. Использовать GetSpikesQuery для поиска скачков скорости
3. Найти пересечение кадров с обеими проблемами

### Запрос 2: "Сравни с эталоном"
```
Сравни run-123 с эталонным run-456.
Покажи различия в позиции, скорости и ускорении.
```

**Действия Cursor:**
1. Использовать GetCompareRunsQuery для каждого параметра (pos.x, vel.x, acc.x)
2. Найти кадры с максимальными различиями
3. Предоставить сводку различий

### Запрос 3: "Проверь целостность данных"
```
Проверь run-123 на наличие NaN, Inf и пропущенных кадров.
```

**Действия Cursor:**
1. Использовать GetNaNQuery для поиска некорректных значений
2. Использовать GetFrameAggregatesQuery для проверки пропусков
3. Предоставить отчёт о целостности данных

---

## API Endpoints Reference

### GET /api/analysis/runs
Список завершённых run'ов.

**Query params:**
- `sourceId` (опционально): фильтр по source_id
- `status` (опционально): фильтр по статусу
- `daysBack` (опционально, по умолчанию 30): количество дней назад

**Response:** JSONEachRow с полями run_id, started_at, ended_at, status, total_events, total_frames, engine_version, source_id

### GET /api/analysis/run/{runId}
Метаданные конкретного run'а.

**Response:** JSONEachRow с полями run_id, started_at, ended_at, duration_seconds, status, total_events, total_frames, max_frame_index, source_id, config, engine_version, seed, end_reason, tags

### GET /api/analysis/series
Временной ряд для run'а.

**Query params:**
- `runId` (обязательно)
- `eventType` (обязательно)
- `sourceId` (обязательно)
- `jsonPath` (обязательно)

**Response:** JSONEachRow с полями frame_index, sim_time, value

### GET /api/analysis/compare
Сравнение двух run'ов.

**Query params:**
- `runId1` (обязательно)
- `runId2` (обязательно)
- `eventType` (обязательно)
- `sourceId` (обязательно)
- `jsonPath` (обязательно)

**Response:** JSONEachRow с полями frame_index, sim_time_1, sim_time_2, value_1, value_2, diff

### POST /api/analysis/query
Выполнение произвольного SELECT запроса.

**Body:** `{"query": "SELECT ..."}`

**Response:** JSONEachRow с результатами запроса

**Ограничение:** Принимает только SELECT запросы (проверка по префиксу).

---

## Связанные документы

- `docs/07-cursor-workflow.md` — общий workflow с Cursor
- `docs/11-phase2-design.md` — проектирование Phase 2 (storage)
- `internal/storage/sql_helpers.go` — реализация SQL helpers
- `internal/storage/schema.sql` — схема ClickHouse
