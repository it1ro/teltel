package eventbus

import (
	"context"
	"github.com/teltel/teltel/internal/event"
)

// Filter определяет условия фильтрации событий для подписки.
type Filter struct {
	// RunID - фильтр по идентификатору run'а (пустая строка = wildcard)
	RunID string

	// SourceID - фильтр по источнику (пустая строка = wildcard)
	SourceID string

	// Channel - фильтр по каналу (пустая строка = wildcard)
	Channel string

	// Types - точное совпадение типов событий
	Types []string

	// TypePrefix - префиксное совпадение типа события
	TypePrefix string

	// TagsAll - событие должно содержать все указанные теги
	TagsAll map[string]string
}

// BackpressurePolicy определяет политику обработки backpressure.
type BackpressurePolicy string

const (
	// BackpressureBlock - Publish блокируется, пока подписчик не освободит место
	BackpressureBlock BackpressurePolicy = "block"

	// BackpressureDropNew - новые события отбрасываются при заполнении очереди
	BackpressureDropNew BackpressurePolicy = "drop_new"

	// BackpressureDropOld - старые события удаляются, очередь работает как ring buffer
	BackpressureDropOld BackpressurePolicy = "drop_old"
)

// SubscriptionOptions определяет параметры подписки.
type SubscriptionOptions struct {
	// BufferSize - размер буфера подписки
	BufferSize int

	// Policy - политика backpressure
	Policy BackpressurePolicy

	// Name - имя подписки для отладки и метрик
	Name string
}

// BusStats содержит статистику EventBus.
type BusStats struct {
	// SubscribersCount - количество активных подписчиков
	SubscribersCount int

	// TotalPublished - общее количество опубликованных событий
	TotalPublished uint64

	// TotalDropped - общее количество отброшенных событий
	TotalDropped uint64
}

// EventBus - интерфейс для маршрутизации событий.
type EventBus interface {
	// Publish публикует одно событие, выполняя fan-out всем подходящим подписчикам.
	// Fan-out выполняется синхронно, без создания goroutine.
	Publish(ctx context.Context, e *event.Event) error

	// PublishBatch публикует несколько событий за один вызов.
	// Возвращает количество успешно опубликованных событий.
	PublishBatch(ctx context.Context, events []*event.Event) (int, error)

	// Subscribe создаёт подписку с фильтром и параметрами.
	// Каждая подписка имеет свою очередь и goroutine для чтения.
	Subscribe(ctx context.Context, filter Filter, opt SubscriptionOptions) (Subscription, error)

	// Stats возвращает статистику EventBus.
	Stats() BusStats

	// Close закрывает EventBus и все подписки.
	Close() error
}

// Subscription представляет подписку на события.
type Subscription interface {
	// C возвращает канал для чтения событий.
	C() <-chan *event.Event

	// Dropped возвращает количество отброшенных событий.
	Dropped() uint64

	// Close закрывает подписку.
	Close() error
}
