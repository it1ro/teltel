package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/teltel/teltel/internal/event"
	"github.com/teltel/teltel/internal/eventbus"
)

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

// BatcherConfig определяет параметры batcher'а.
type BatcherConfig struct {
	// ClickHouse connection
	ClickHouseURL string

	// Flush условия
	BatchSize     int           // количество событий для flush
	FlushInterval time.Duration // интервал для flush

	// EventBus подписка
	Filter     eventbus.Filter
	BufferSize int
	Policy     eventbus.BackpressurePolicy

	// Retry политика
	MaxRetries   int
	RetryBackoff time.Duration
}

// batcher реализует Batcher интерфейс.
type batcher struct {
	config    BatcherConfig
	eventBus  eventbus.EventBus
	client    Client
	metadata  *MetadataManager

	// Состояние
	mu            sync.Mutex
	batch         []*event.Event
	lastFlushTime time.Time
	started       bool
	stopCh        chan struct{}
	doneCh        chan struct{}

	// Статистика
	totalBatches atomic.Uint64
	totalEvents  atomic.Uint64
	totalErrors  atomic.Uint64
}

// NewBatcher создаёт новый Batcher.
func NewBatcher(eventBus eventbus.EventBus, client Client, config BatcherConfig) Batcher {
	return &batcher{
		config:    config,
		eventBus:  eventBus,
		client:    client,
		metadata:  NewMetadataManager(client),
		batch:     make([]*event.Event, 0, config.BatchSize),
		stopCh:    make(chan struct{}),
		doneCh:    make(chan struct{}),
	}
}

// Start запускает batcher и подписывается на EventBus.
func (b *batcher) Start(ctx context.Context) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.started {
		return fmt.Errorf("batcher already started")
	}

	// Создаём подписку на EventBus
	sub, err := b.eventBus.Subscribe(ctx, b.config.Filter, eventbus.SubscriptionOptions{
		BufferSize: b.config.BufferSize,
		Policy:     b.config.Policy,
		Name:       "clickhouse-batcher",
	})
	if err != nil {
		return fmt.Errorf("failed to subscribe to eventbus: %w", err)
	}

	b.started = true
	b.lastFlushTime = time.Now()

	// Запускаем фоновую goroutine
	go b.run(ctx, sub)

	return nil
}

// run обрабатывает события из подписки.
func (b *batcher) run(ctx context.Context, sub eventbus.Subscription) {
	defer close(b.doneCh)

	// Таймер для периодического flush
	flushTicker := time.NewTicker(b.config.FlushInterval)
	defer flushTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Контекст отменён, выполняем финальный flush
			b.flush(ctx)
			return

		case <-b.stopCh:
			// Stop вызван, выполняем финальный flush
			b.flush(ctx)
			return

		case <-flushTicker.C:
			// Периодический flush по времени
			b.mu.Lock()
			if len(b.batch) > 0 {
				b.mu.Unlock()
				b.flush(ctx)
			} else {
				b.mu.Unlock()
			}

		case e, ok := <-sub.C():
			if !ok {
				// Канал закрыт, выполняем финальный flush
				b.flush(ctx)
				return
			}

			// Добавляем событие в батч
			b.mu.Lock()
			b.batch = append(b.batch, e)
			batchSize := len(b.batch)
			b.mu.Unlock()

			// Проверяем flush по размеру батча
			if batchSize >= b.config.BatchSize {
				b.flush(ctx)
			}

			// Проверяем flush по run.end
			if e.Type == "run.end" {
				b.flush(ctx)
			}
		}
	}
}

// flush записывает накопленный батч в ClickHouse.
func (b *batcher) flush(ctx context.Context) {
	b.mu.Lock()
	if len(b.batch) == 0 {
		b.mu.Unlock()
		return
	}

	// Копируем батч для записи
	batch := make([]*event.Event, len(b.batch))
	copy(batch, b.batch)
	b.batch = b.batch[:0] // Очищаем батч
	b.lastFlushTime = time.Now()
	b.mu.Unlock()

	// Записываем события
	if err := b.writeBatch(ctx, batch); err != nil {
		b.totalErrors.Add(1)
		// Логируем ошибку, но продолжаем работу
		// В production здесь должен быть proper logger
		fmt.Printf("Batcher flush error: %v\n", err)
		return
	}

	// Обновляем статистику
	b.totalBatches.Add(1)
	b.totalEvents.Add(uint64(len(batch)))

	// Обновляем метаданные run'ов
	b.updateMetadata(ctx, batch)
}

// writeBatch записывает батч событий в ClickHouse.
func (b *batcher) writeBatch(ctx context.Context, events []*event.Event) error {
	if len(events) == 0 {
		return nil
	}

	// Сериализуем события в JSONEachRow формат
	jsonRows := make([][]byte, 0, len(events))
	for _, e := range events {
		row := b.eventToRow(e)
		jsonData, err := json.Marshal(row)
		if err != nil {
			return fmt.Errorf("failed to marshal event: %w", err)
		}
		jsonRows = append(jsonRows, jsonData)
	}

	// Объединяем в NDJSON формат
	ndjson := make([]byte, 0)
	for i, row := range jsonRows {
		if i > 0 {
			ndjson = append(ndjson, '\n')
		}
		ndjson = append(ndjson, row...)
	}

	// Вставляем в ClickHouse с retry
	var lastErr error
	for attempt := 0; attempt <= b.config.MaxRetries; attempt++ {
		if attempt > 0 {
			// Backoff перед повтором
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(b.config.RetryBackoff * time.Duration(attempt)):
			}
		}

		err := b.client.InsertBatch(ctx, "telemetry_events", ndjson)
		if err == nil {
			return nil
		}
		lastErr = err
	}

	return fmt.Errorf("failed to insert batch after %d retries: %w", b.config.MaxRetries, lastErr)
}

// eventToRow преобразует Event в строку для ClickHouse.
func (b *batcher) eventToRow(e *event.Event) map[string]interface{} {
	row := map[string]interface{}{
		"run_id":      e.RunID,
		"source_id":   e.SourceID,
		"channel":     e.Channel,
		"type":        e.Type,
		"frame_index": e.FrameIndex,
		"sim_time":    e.SimTime,
	}

	if e.WallTimeMs != nil {
		row["wall_time_ms"] = *e.WallTimeMs
	}

	// Сериализуем tags и payload как JSON строки
	if e.Tags != nil {
		tagsJSON, _ := json.Marshal(e.Tags)
		row["tags"] = string(tagsJSON)
	} else {
		row["tags"] = "{}"
	}

	if e.Payload != nil {
		row["payload"] = string(e.Payload)
	} else {
		row["payload"] = "{}"
	}

	return row
}

// updateMetadata обновляет метаданные run'ов на основе событий.
func (b *batcher) updateMetadata(ctx context.Context, events []*event.Event) {
	// Группируем события по run_id
	runs := make(map[string][]*event.Event)
	for _, e := range events {
		runs[e.RunID] = append(runs[e.RunID], e)
	}

	// Обновляем метаданные для каждого run'а
	for runID, runEvents := range runs {
		b.metadata.UpdateFromEvents(ctx, runID, runEvents)
	}
}

// Stop останавливает batcher, выполняя финальный flush.
func (b *batcher) Stop(ctx context.Context) error {
	b.mu.Lock()
	if !b.started {
		b.mu.Unlock()
		return nil
	}
	b.mu.Unlock()

	// Сигнализируем остановку
	close(b.stopCh)

	// Ждём завершения
	select {
	case <-b.doneCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Stats возвращает статистику batcher'а.
func (b *batcher) Stats() BatcherStats {
	b.mu.Lock()
	defer b.mu.Unlock()

	return BatcherStats{
		TotalBatches:    b.totalBatches.Load(),
		TotalEvents:     b.totalEvents.Load(),
		TotalErrors:     b.totalErrors.Load(),
		CurrentBatchSize: len(b.batch),
		LastFlushTime:   b.lastFlushTime,
	}
}
