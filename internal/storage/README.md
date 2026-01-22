# Storage Package — Phase 2

Этот пакет реализует Phase 2 — Storage & Analysis для teltel.

## Компоненты

### ClickHouse Client (`client.go`)
HTTP клиент для работы с ClickHouse через HTTP API.

### Schema Manager (`schema.go`)
Управление схемой ClickHouse: создание таблиц `telemetry_events` и `run_metadata`.

### Batcher (`batcher.go`)
Подписчик EventBus, который собирает события в батчи и записывает их в ClickHouse.

### Metadata Manager (`metadata.go`)
Управление метаданными run'ов в таблице `run_metadata`.

### SQL Helpers (`sql_helpers.go`)
Готовые SQL запросы для анализа телеметрии.

## Использование

### Инициализация

```go
// Создаём ClickHouse клиент
client := storage.NewHTTPClient("http://localhost:8123")

// Инициализируем схему
schemaManager := storage.NewSchemaManager(client)
if err := schemaManager.InitSchema(ctx); err != nil {
    log.Fatalf("Failed to init schema: %v", err)
}

// Создаём Batcher
batcherConfig := storage.BatcherConfig{
    ClickHouseURL: "http://localhost:8123",
    BatchSize:     10000,
    FlushInterval: 500 * time.Millisecond,
    Filter:        eventbus.Filter{}, // все события
    BufferSize:    8192,
    Policy:        eventbus.BackpressureBlock,
    MaxRetries:    3,
    RetryBackoff:  100 * time.Millisecond,
}
batcher := storage.NewBatcher(eventBus, client, batcherConfig)

// Запускаем Batcher
if err := batcher.Start(ctx); err != nil {
    log.Fatalf("Failed to start batcher: %v", err)
}
defer batcher.Stop(ctx)
```

### SQL Helpers

SQL helpers предоставляют готовые запросы для анализа:

```go
// Извлечение временного ряда
query := storage.GetSeriesQuery("run-123", "body.state", "drive-engine", "pos.x")

// Поиск выбросов
query := storage.GetOutliersQuery("run-123", "wheel.force", "slipRatio", -1.0, 2.0)

// Сравнение run'ов
query := storage.GetCompareRunsQuery("run-123", "run-456", "body.state", "drive-engine", "pos.x")

// Статистика по run'ам
query := storage.GetRunStatsQuery()
```

## Схема данных

### telemetry_events
Основная таблица для хранения событий телеметрии.

### run_metadata
Таблица метаданных run'ов (статус, статистика, конфигурация).

Подробности см. в `schema.sql` и `docs/11-phase2-design.md`.
