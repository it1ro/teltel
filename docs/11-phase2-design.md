# Phase 2 Design — Storage & Analysis

Этот документ описывает проектирование Phase 2 — Storage & Analysis.

**Статус:** проектирование  
**Версия:** v0.2.0 (планируется)  
**Основа:** Phase 1 (v0.1.0) заморожена

---

## Цель Phase 2

> Сделать run'ы анализируемыми после завершения.

Phase 2 добавляет:
- долговременное хранение телеметрии в ClickHouse
- асинхронную запись через Batcher
- SQL helpers для анализа run'ов

**Важно:**
- Phase 2 не изменяет архитектурные контракты Phase 1
- Phase 2 не затрагивает live-поток
- ClickHouse используется только для post-run анализа

---

## 1. ClickHouse Schema

### 1.1 Основная таблица событий

```sql
CREATE TABLE telemetry_events (
  -- Идентификаторы
  run_id String,
  source_id LowCardinality(String),
  channel LowCardinality(String),
  type LowCardinality(String),
  
  -- Временные метки
  frame_index UInt32,
  sim_time Float64,
  wall_time_ms Nullable(UInt64),
  
  -- Метаданные
  tags String,  -- JSON строка для фильтрации
  payload String,  -- JSON строка с данными события
  
  -- Служебные поля
  inserted_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (run_id, frame_index, source_id)
PARTITION BY toYYYYMM(inserted_at)
SETTINGS index_granularity = 8192;
```

### 1.2 Обоснование схемы

#### ORDER BY (run_id, frame_index, source_id)

- `run_id` — первичный ключ для анализа одного run'а
- `frame_index` — основная ось детерминированного анализа
- `source_id` — позволяет изолировать источники в рамках run'а

**Преимущества:**
- все события одного run'а лежат рядом
- эффективный range-scan по frameIndex
- быстрая фильтрация по runId

#### LowCardinality для строковых полей

Используется для:
- `source_id` — 2 значения (flight-engine, drive-engine)
- `channel` — ограниченный набор (physics, aero, drivetrain, etc.)
- `type` — ограниченный набор типов событий

**Преимущества:**
- уменьшение размера данных
- ускорение фильтрации
- эффективное использование индексов

#### JSON как String

`tags` и `payload` хранятся как строки, а не как тип JSON.

**Причины:**
- ClickHouse JSON тип требует парсинга при вставке
- String позволяет отложенный парсинг только при запросах
- NDJSON формат уже является строками
- Гибкость для эволюции схемы payload

**Парсинг при запросах:**
```sql
-- Извлечение значения из payload
JSONExtractString(payload, 'pos', 'x') AS pos_x

-- Проверка наличия тега
JSONHas(tags, 'vehicle') AS has_vehicle
```

#### PARTITION BY toYYYYMM(inserted_at)

Партиционирование по месяцам:
- упрощает управление данными
- позволяет удалять старые данные по партициям
- не влияет на запросы по runId (данные одного run в одной партиции)

#### Nullable для wall_time_ms

`wall_time_ms` опциональное поле в event model, поэтому Nullable.

---

### 1.3 Таблица метаданных run'ов

```sql
CREATE TABLE run_metadata (
  run_id String,
  
  -- Временные метки
  started_at DateTime,
  ended_at Nullable(DateTime),
  duration_seconds Nullable(Float64),
  
  -- Статистика
  total_events UInt64,
  total_frames UInt32,
  max_frame_index UInt32,
  
  -- Метаданные из run.start
  source_id LowCardinality(String),
  config String,  -- JSON строка с конфигурацией
  engine_version String,
  seed Nullable(UInt64),
  
  -- Статус
  status LowCardinality(String),  -- 'running', 'completed', 'failed', 'cancelled'
  end_reason Nullable(String),  -- из run.end payload
  
  -- Теги run'а (из первого run.start события)
  tags String,  -- JSON строка
  
  inserted_at DateTime DEFAULT now(),
  updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY run_id
SETTINGS index_granularity = 8192;
```

### 1.4 Обоснование run_metadata

#### Назначение

- быстрый поиск run'ов
- фильтрация по метаданным
- статистика без сканирования всех событий
- отслеживание lifecycle run'ов

#### ReplacingMergeTree

Позволяет обновлять метаданные run'а:
- `started_at` устанавливается при первом событии
- `ended_at`, `status`, `end_reason` обновляются при `run.end`
- `total_events`, `total_frames` обновляются периодически

**Альтернатива:** можно использовать обычный MergeTree и обновлять через ALTER, но ReplacingMergeTree проще для метаданных.

#### Отдельная таблица vs денормализация

**Преимущества отдельной таблицы:**
- быстрый поиск run'ов без сканирования событий
- эффективное обновление метаданных
- возможность индексов на метаданные

**Недостатки:**
- необходимость синхронизации двух таблиц
- дополнительная сложность

**Решение:** отдельная таблица оправдана для метаданных, которые обновляются независимо от событий.

---

### 1.5 Материализованные представления (опционально)

Для частых запросов можно создать материализованные представления:

```sql
-- Агрегация по кадрам (frame-level aggregates)
CREATE MATERIALIZED VIEW frame_aggregates
ENGINE = SummingMergeTree
ORDER BY (run_id, frame_index)
AS SELECT
  run_id,
  frame_index,
  count() AS events_count,
  min(sim_time) AS sim_time,
  max(wall_time_ms) AS max_wall_time
FROM telemetry_events
GROUP BY run_id, frame_index;
```

**Примечание:** материализованные представления добавляются в Phase 3, если потребуется оптимизация частых запросов.

---

## 2. Batcher API

### 2.1 Интерфейс Batcher

```go
// Batcher собирает события из EventBus и записывает их в ClickHouse батчами.
type Batcher interface {
  // Start запускает batcher и подписывается на EventBus.
  // Batcher работает в фоновом режиме до вызова Stop.
  Start(ctx context.Context) error
  
  // Stop останавливает batcher, выполняя финальный flush.
  Stop(ctx context.Context) error
  
  // Stats возвращает статистику batcher'а.
  Stats() BatcherStats
}

// BatcherStats содержит статистику batcher'а.
type BatcherStats struct {
  // TotalBatches - общее количество записанных батчей
  TotalBatches uint64
  
  // TotalEvents - общее количество записанных событий
  TotalEvents uint64
  
  // TotalErrors - количество ошибок записи
  TotalErrors uint64
  
  // CurrentBatchSize - текущий размер накопленного батча
  CurrentBatchSize int
  
  // LastFlushTime - время последнего flush
  LastFlushTime time.Time
}
```

### 2.2 Конфигурация Batcher

```go
// BatcherConfig определяет параметры batcher'а.
type BatcherConfig struct {
  // ClickHouse connection
  ClickHouseURL string
  
  // Flush условия
  BatchSize     int           // количество событий для flush
  FlushInterval time.Duration // интервал для flush
  
  // EventBus подписка
  Filter        eventbus.Filter
  BufferSize    int
  Policy        eventbus.BackpressurePolicy
  
  // Retry политика
  MaxRetries    int
  RetryBackoff  time.Duration
}
```

### 2.3 Поведение Batcher

#### Подписка на EventBus

Batcher создаёт подписку с параметрами:
- `Filter`: пустой (все события) или фильтр по runId
- `BufferSize`: 8192 (большой буфер для batch-записи)
- `Policy`: `BackpressureBlock` (не теряем данные)

**Важно:** Batcher блокирует EventBus при переполнении, но это не влияет на live-поток, так как live-подписчики используют `drop_old` политику.

#### Сбор событий

Batcher накапливает события в памяти до выполнения flush-условий.

#### Flush-условия

Batcher выполняет flush при выполнении **любого** условия:

1. **Количество событий ≥ BatchSize**
   - Типичное значение: 10,000
   - Баланс между размером батча и задержкой

2. **Возраст батча ≥ FlushInterval**
   - Типичное значение: 500ms
   - Гарантирует запись даже при низкой частоте событий

3. **Событие `run.end`**
   - Немедленный flush для завершённого run'а
   - Гарантирует сохранность данных run'а

4. **Вызов Stop()**
   - Финальный flush при остановке batcher'а

#### Запись в ClickHouse

Batcher использует `INSERT ... FORMAT JSONEachRow`:

```go
// Псевдокод записи
INSERT INTO telemetry_events FORMAT JSONEachRow
{"run_id":"r1","source_id":"drive-engine",...}
{"run_id":"r1","source_id":"drive-engine",...}
```

**Формат данных:**
- события сериализуются как JSON
- порядок событий сохраняется
- batch вставляется атомарно (одна транзакция)

#### Обработка ошибок

При ошибке записи:
1. Retry с экспоненциальным backoff
2. Максимум `MaxRetries` попыток
3. После исчерпания попыток — логирование и продолжение работы
4. События могут быть потеряны при отказе ClickHouse

**Принцип:** Batcher предпочитает деградацию остановке системы.

#### Обновление run_metadata

Batcher обновляет `run_metadata`:
- при первом событии run'а — создаёт запись
- при событии `run.start` — обновляет метаданные
- при событии `run.end` — обновляет статус и end_reason
- периодически — обновляет статистику (total_events, total_frames)

**Оптимизация:** обновления метаданных можно выполнять асинхронно, не блокируя запись событий.

---

### 2.4 Интеграция с EventBus

Batcher подписывается на EventBus в `Start()`:

```go
// Псевдокод интеграции
func (b *batcher) Start(ctx context.Context) error {
  sub, err := b.eventBus.Subscribe(ctx, b.config.Filter, eventbus.SubscriptionOptions{
    BufferSize: b.config.BufferSize,
    Policy:     b.config.Policy,
    Name:       "clickhouse-batcher",
  })
  if err != nil {
    return err
  }
  
  go b.run(ctx, sub)
  return nil
}
```

**Изоляция:** Batcher работает в отдельной goroutine и не влияет на live-поток.

---

### 2.5 Run Lifecycle

#### Определение завершения run'а

Run считается завершённым при:
- событии `run.end` с соответствующим payload
- отсутствии событий в течение таймаута (опционально, для Phase 3)

#### Метаданные run'а

Batcher извлекает метаданные из:
- `run.start` — конфигурация, версия, seed
- `run.end` — статус, причина завершения
- теги из первого события run'а

---

## 3. SQL Helpers

### 3.1 Извлечение временных рядов

#### Базовый запрос для series

```sql
-- Извлечение series для одного run'а
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'pos', 'x') AS pos_x,
  JSONExtractFloat(payload, 'pos', 'y') AS pos_y,
  JSONExtractFloat(payload, 'pos', 'z') AS pos_z
FROM telemetry_events
WHERE run_id = 'r1'
  AND type = 'body.state'
  AND source_id = 'drive-engine'
ORDER BY frame_index;
```

#### Извлечение нескольких series

```sql
-- Извлечение нескольких series для одного run'а
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'pos', 'x') AS pos_x,
  JSONExtractFloat(payload, 'vel', 'x') AS vel_x,
  JSONExtractFloat(payload, 'omega', 'x') AS omega_x
FROM telemetry_events
WHERE run_id = 'r1'
  AND type = 'body.state'
  AND source_id = 'drive-engine'
ORDER BY frame_index;
```

#### Извлечение series с фильтрацией по тегам

```sql
-- Извлечение series с фильтрацией по тегам
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'force', 'x') AS force_x,
  JSONExtractFloat(payload, 'slipRatio') AS slip_ratio
FROM telemetry_events
WHERE run_id = 'r1'
  AND type = 'wheel.force'
  AND JSONExtractString(tags, 'wheelId') = 'wheel_rr'
ORDER BY frame_index;
```

---

### 3.2 Поиск аномалий

#### Поиск выбросов (outliers)

```sql
-- Поиск кадров с аномальными значениями
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'slipRatio') AS slip_ratio,
  JSONExtractFloat(payload, 'force', 'x') AS force_x
FROM telemetry_events
WHERE run_id = 'r1'
  AND type = 'wheel.force'
  AND (
    JSONExtractFloat(payload, 'slipRatio') > 2.0
    OR JSONExtractFloat(payload, 'slipRatio') < -1.0
  )
ORDER BY frame_index;
```

#### Поиск скачков (spikes)

```sql
-- Поиск резких изменений между кадрами
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, 'vel', 'x') AS vel_x,
    lagInFrame(JSONExtractFloat(payload, 'vel', 'x')) OVER (
      PARTITION BY run_id ORDER BY frame_index
    ) AS prev_vel_x
  FROM telemetry_events
  WHERE run_id = 'r1'
    AND type = 'body.state'
)
SELECT
  frame_index,
  vel_x,
  prev_vel_x,
  abs(vel_x - prev_vel_x) AS delta
FROM series
WHERE abs(vel_x - prev_vel_x) > 10.0
ORDER BY frame_index;
```

**Примечание:** `lagInFrame` — псевдофункция, в реальности используется `lag()` с правильным PARTITION BY.

#### Поиск NaN и Inf

```sql
-- Поиск некорректных числовых значений
SELECT
  frame_index,
  sim_time,
  type,
  payload
FROM telemetry_events
WHERE run_id = 'r1'
  AND (
    isNaN(JSONExtractFloat(payload, 'pos', 'x'))
    OR isInfinite(JSONExtractFloat(payload, 'pos', 'x'))
  )
ORDER BY frame_index;
```

---

### 3.3 Сравнение run'ов

#### Сравнение двух run'ов

```sql
-- Сравнение series между двумя run'ами
SELECT
  r1.frame_index,
  r1.sim_time AS sim_time_1,
  r2.sim_time AS sim_time_2,
  JSONExtractFloat(r1.payload, 'pos', 'x') AS pos_x_1,
  JSONExtractFloat(r2.payload, 'pos', 'x') AS pos_x_2,
  JSONExtractFloat(r2.payload, 'pos', 'x') - JSONExtractFloat(r1.payload, 'pos', 'x') AS diff
FROM telemetry_events AS r1
INNER JOIN telemetry_events AS r2
  ON r1.frame_index = r2.frame_index
WHERE r1.run_id = 'r1'
  AND r2.run_id = 'r2'
  AND r1.type = 'body.state'
  AND r2.type = 'body.state'
  AND r1.source_id = r2.source_id
ORDER BY r1.frame_index;
```

#### Статистика по run'ам

```sql
-- Статистика по run'ам
SELECT
  run_id,
  count() AS total_events,
  min(frame_index) AS min_frame,
  max(frame_index) AS max_frame,
  max(frame_index) - min(frame_index) AS frame_range,
  min(sim_time) AS min_sim_time,
  max(sim_time) AS max_sim_time,
  max(sim_time) - min(sim_time) AS sim_duration
FROM telemetry_events
GROUP BY run_id
ORDER BY run_id;
```

---

### 3.4 Агрегации по кадрам

#### Агрегация событий в кадре

```sql
-- Количество событий каждого типа в кадре
SELECT
  run_id,
  frame_index,
  type,
  count() AS events_count
FROM telemetry_events
WHERE run_id = 'r1'
GROUP BY run_id, frame_index, type
ORDER BY frame_index, type;
```

#### Извлечение frame.end метрик

```sql
-- Извлечение метрик производительности из frame.end
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'dt') AS dt,
  JSONExtractInt(payload, 'substeps') AS substeps,
  JSONExtractFloat(payload, 'perf', 'cpu_time_ms') AS cpu_time_ms
FROM telemetry_events
WHERE run_id = 'r1'
  AND type = 'frame.end'
ORDER BY frame_index;
```

---

### 3.5 Поиск run'ов

#### Поиск по метаданным

```sql
-- Поиск run'ов по метаданным
SELECT
  run_id,
  started_at,
  ended_at,
  status,
  total_events,
  total_frames,
  engine_version
FROM run_metadata
WHERE source_id = 'drive-engine'
  AND status = 'completed'
  AND started_at >= now() - INTERVAL 7 DAY
ORDER BY started_at DESC;
```

#### Поиск run'ов по тегам

```sql
-- Поиск run'ов по тегам
SELECT
  run_id,
  started_at,
  status,
  tags
FROM run_metadata
WHERE JSONExtractString(tags, 'vehicle') = 'car01'
  AND JSONExtractString(tags, 'scene') = 'freeflight'
ORDER BY started_at DESC;
```

---

### 3.6 Корреляционный анализ

#### Корреляция между series

```sql
-- Корреляция между двумя series
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, 'aoa') AS aoa,
    JSONExtractFloat(payload, 'cl') AS cl
  FROM telemetry_events
  WHERE run_id = 'r1'
    AND type = 'aero.state'
    AND source_id = 'flight-engine'
)
SELECT
  frame_index,
  aoa,
  cl,
  aoa * cl AS product
FROM series
WHERE aoa IS NOT NULL AND cl IS NOT NULL
ORDER BY frame_index;
```

---

## 4. Интеграция с существующей архитектурой

### 4.1 Неизменяемые компоненты Phase 1

Следующие компоненты **не изменяются** в Phase 2:

- **Event model** — структура событий зафиксирована
- **EventBus API** — интерфейс и поведение не меняются
- **HTTP Ingest** — endpoint и формат не меняются
- **Live Buffer** — работает независимо от ClickHouse
- **WebSocket API** — live-поток не затрагивается

### 4.2 Новые компоненты Phase 2

Добавляются новые компоненты:

- **Batcher** — подписчик EventBus, записывает в ClickHouse
- **ClickHouse client** — клиент для записи и чтения
- **Run metadata manager** — управление метаданными run'ов

### 4.3 Точки интеграции

#### EventBus → Batcher

Batcher подписывается на EventBus как обычный подписчик:
- использует существующий интерфейс `Subscribe()`
- не требует изменений в EventBus
- изолирован от других подписчиков

#### Batcher → ClickHouse

Batcher использует ClickHouse HTTP API:
- не требует изменений в ClickHouse
- работает асинхронно
- не блокирует live-поток

---

## 5. Ограничения и компромиссы

### 5.1 Задержка записи

События записываются в ClickHouse с задержкой:
- минимальная задержка: FlushInterval (500ms)
- максимальная задержка: зависит от размера батча

**Последствия:**
- анализ run'а возможен только после завершения
- live-анализ через ClickHouse невозможен

**Решение:** live-анализ остаётся через Live Buffer и WebSocket API.

### 5.2 Потеря данных при отказе

При отказе ClickHouse события могут быть потеряны:
- Batcher не блокирует систему
- события накапливаются в памяти до flush
- при перезапуске накопленные события теряются

**Последствия:**
- best-effort доставка соответствует архитектуре
- критичные данные должны дублироваться

**Решение:** соответствует принципам Phase 1 (best-effort, деградация вместо отказа).

### 5.3 Размер батчей

Большие батчи:
- эффективнее для ClickHouse
- больше задержка записи
- больше риск потери данных при сбое

Маленькие батчи:
- меньше задержка
- больше накладные расходы
- меньше риск потери данных

**Компромисс:** BatchSize = 10,000, FlushInterval = 500ms.

---

## 6. Метрики и мониторинг

### 6.1 Метрики Batcher

Batcher предоставляет метрики:
- `TotalBatches` — количество записанных батчей
- `TotalEvents` — количество записанных событий
- `TotalErrors` — количество ошибок записи
- `CurrentBatchSize` — текущий размер батча
- `LastFlushTime` — время последнего flush

### 6.2 Метрики ClickHouse

Рекомендуется мониторить:
- размер таблиц
- скорость вставки
- время выполнения запросов
- использование диска

---

## 7. Миграция и развёртывание

### 7.1 Создание схемы

При развёртывании Phase 2:
1. Создать таблицы `telemetry_events` и `run_metadata`
2. Настроить ClickHouse connection
3. Запустить Batcher

### 7.2 Обратная совместимость

Phase 2 полностью обратно совместима с Phase 1:
- существующие компоненты работают без изменений
- Batcher — опциональный компонент
- при отказе Batcher система продолжает работать

---

## 8. Следующие шаги

После проектирования Phase 2:

1. **Реализация Batcher**
   - интерфейс и конфигурация
   - интеграция с EventBus
   - запись в ClickHouse
   - обновление run_metadata

2. **Создание ClickHouse схемы**
   - таблицы `telemetry_events` и `run_metadata`
   - индексы и оптимизации

3. **SQL helpers**
   - библиотека запросов
   - примеры использования
   - документация для Cursor

4. **Тестирование**
   - unit-тесты Batcher
   - интеграционные тесты с ClickHouse
   - нагрузочное тестирование

---

## Связанные документы

- `docs/03-event-model.md` — модель событий
- `docs/04-eventbus.md` — EventBus контракт
- `docs/05-ingest-and-storage.md` — ingest и storage pipeline
- `docs/07-cursor-workflow.md` — workflow с Cursor
- `docs/09-roadmap.md` — roadmap проекта
- `docs/PHASE1_FREEZE.md` — заморозка Phase 1
- `ADR/0002-ndjson-and-clickhouse.md` — решение об использовании ClickHouse
