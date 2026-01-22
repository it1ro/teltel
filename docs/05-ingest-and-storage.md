# Ingest and Storage

Этот документ описывает путь телеметрических данных
от источников (Flight Engine, Drive Engine)
до долговременного хранения в ClickHouse.

---

## Формат данных

Основной формат телеметрии — **NDJSON**.

- одна строка = одно событие
- события независимы
- порядок best‑effort
- формат удобен для стриминга и batch‑вставок

Пример:

```json
{"v":1,"runId":"r1","sourceId":"drive-engine","type":"wheel.force","frameIndex":120,"payload":{...}}
{"v":1,"runId":"r1","sourceId":"drive-engine","type":"wheel.force","frameIndex":121,"payload":{...}}
```

---

## HTTP Ingest

### Назначение

- принимать NDJSON события от движков
- выполнять минимальную валидацию
- передавать события в EventBus

---

### Поведение

- ingest принимает поток строк
- каждая строка обрабатывается независимо
- payload не парсится
- ошибки в одной строке не влияют на остальные

---

### Гарантии

- ingest не гарантирует доставку
- ingest не блокирует движок при перегрузке
- ingest предпочитает деградацию отказу

---

## EventBus → Storage Pipeline

ClickHouse **не участвует в live‑потоке**.

Запись в storage выполняется асинхронно
через подписчика EventBus — `Batcher`.

---

## Batcher

### Назначение

- собирать события в пачки
- управлять flush‑логикой
- писать данные в ClickHouse

---

### Flush‑условия

Batcher выполняет flush при выполнении любого условия:

- количество событий ≥ N
- возраст пачки ≥ T
- завершение run’а (`run.end`)

Типичные значения:
- N = 5 000 – 20 000
- T = 200 – 500 ms

---

### Поведение при перегрузке

- batcher может блокироваться
- batcher не влияет на live‑поток
- при отказе storage данные могут быть потеряны

---

## ClickHouse

### Назначение

- долговременное хранение телеметрии
- аналитические запросы
- сравнение run’ов
- работа с Cursor

---

### Схема таблицы (пример)

```sql
CREATE TABLE telemetry_events (
  run_id String,
  source_id LowCardinality(String),
  channel LowCardinality(String),
  type LowCardinality(String),

  frame_index UInt32,
  sim_time Float64,
  wall_time_ms UInt64,

  tags JSON,
  payload JSON
)
ENGINE = MergeTree
ORDER BY (run_id, frame_index);
```

---

### Вставка данных

- используется `INSERT ... FORMAT JSONEachRow`
- данные вставляются **только пачками**
- одиночные вставки не допускаются

---

### Принципы хранения

- append‑only
- отсутствие транзакций
- данные одного run лежат рядом
- оптимизация под range‑scan по frameIndex

---

## Live vs Storage

Важно различать:

### Live‑данные
- обслуживаются Live Buffer
- используются Web UI
- минимальная задержка
- не зависят от ClickHouse

### Storage‑данные
- пишутся асинхронно
- используются для анализа
- могут появляться с задержкой
- используются Cursor

---

## Cursor и ClickHouse

Cursor использует ClickHouse для:

- извлечения временных рядов
- поиска аномалий
- сравнения run’ов
- построения гипотез

ClickHouse является **основным источником данных для Cursor**.

---

## Связанные документы

- `docs/02-architecture.md`
- `docs/03-event-model.md`
- `docs/04-eventbus.md`
- `docs/07-cursor-workflow.md`
