# EventBus

EventBus — центральный компонент teltel.
Он отвечает за маршрутизацию событий от ingest‑слоя
к подписчикам (live‑UI, storage, анализаторы).

EventBus не хранит данные и не гарантирует доставку.
Он оптимизирован под fan‑out и управление backpressure.

---

## Назначение

EventBus решает следующие задачи:

- маршрутизация событий нескольким потребителям
- фильтрация событий по ключевым полям
- изоляция медленных подписчиков
- управление давлением (backpressure)

EventBus **не является**:
- брокером сообщений общего назначения
- журналом событий
- системой хранения
- сетевым транспортом

---

## Общие принципы

- работает in‑process
- не парсит payload
- best‑effort доставка
- отсутствие глобального порядка
- явная политика backpressure

---

## Модель события

EventBus работает с объектами `Event`,
описанными в `docs/03-event-model.md`.

Payload события передаётся как `[]byte`
и не интерпретируется EventBus.

---

## Интерфейс EventBus

```go
type EventBus interface {
  Publish(ctx context.Context, e Event) error
  PublishBatch(ctx context.Context, events []Event) (int, error)

  Subscribe(
    ctx context.Context,
    filter Filter,
    opt SubscriptionOptions,
  ) (Subscription, error)

  Stats() BusStats
  Close() error
}
```

---

## Publish

### `Publish`

- публикует одно событие
- выполняет fan‑out всем подходящим подписчикам
- может блокироваться в зависимости от политики подписчиков

Publish:
- не гарантирует доставку
- не гарантирует порядок между разными источниками
- возвращает ошибку только при отмене контекста или закрытии bus

---

### `PublishBatch`

- публикует несколько событий за один вызов
- используется ingest‑слоем и batch‑writer’ом
- снижает накладные расходы

---

## Subscribe

Подписка создаётся с фильтром и параметрами очереди.

```go
type Filter struct {
  RunID      string
  SourceID   string
  Channel    string

  Types      []string
  TypePrefix string

  TagsAll    map[string]string
}
```

Правила фильтрации:
- пустое поле = wildcard
- `Types` — точное совпадение
- `TypePrefix` — префиксное совпадение
- `TagsAll` — событие должно содержать все пары

---

## SubscriptionOptions

```go
type SubscriptionOptions struct {
  BufferSize int
  Policy     BackpressurePolicy
  Name       string
}
```

`Name` используется для:
- отладки
- метрик
- анализа деградаций

---

## BackpressurePolicy

```go
type BackpressurePolicy string

const (
  BackpressureBlock   = "block"
  BackpressureDropNew = "drop_new"
  BackpressureDropOld = "drop_old"
)
```

### Семантика

- `block`  
  Publish блокируется, пока подписчик не освободит место.

- `drop_new`  
  Новые события отбрасываются при заполнении очереди.

- `drop_old`  
  Старые события удаляются, очередь работает как ring buffer.

---

## Subscription

```go
type Subscription interface {
  C() <-chan Event
  Dropped() uint64
  Close() error
}
```

Каждая подписка:
- имеет собственную очередь
- изолирована от других подписчиков
- ведёт счётчик отброшенных событий

---

## Гарантии и ограничения

### Гарантируется

- best‑effort порядок в рамках `runId + sourceId`
- изоляция backpressure между подписчиками
- отсутствие блокировки при drop‑политиках

---

### Не гарантируется

- глобальный порядок
- доставка всех событий
- сохранность данных
- replay

---

## Типовые подписчики

### Live Web UI

- Policy: `drop_old`
- BufferSize: 2048
- Назначение: live‑визуализация

---

### ClickHouse Writer

- Policy: `block`
- BufferSize: 8192
- Назначение: долговременное хранение

---

### Debug / Inspector

- Policy: `drop_new`
- BufferSize: 1024
- Назначение: временный анализ

---

## Ошибки и деградация

- медленный подписчик не влияет на остальных
- при перегрузке данные могут отбрасываться
- EventBus предпочитает деградацию блокировке

---

## Связанные документы

- `docs/02-architecture.md`
- `docs/03-event-model.md`
- `docs/05-ingest-and-storage.md`
