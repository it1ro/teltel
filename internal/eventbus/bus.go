package eventbus

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/teltel/teltel/internal/event"
)

// bus реализует EventBus интерфейс.
type bus struct {
	mu          sync.RWMutex
	subscribers []*subscription

	totalPublished atomic.Uint64
	totalDropped   atomic.Uint64
	closed         atomic.Bool
}

// New создаёт новый EventBus.
func New() EventBus {
	return &bus{
		subscribers: make([]*subscription, 0),
	}
}

// Publish публикует одно событие, выполняя синхронный fan-out.
// Fan-out выполняется без создания goroutine на событие.
func (b *bus) Publish(ctx context.Context, e *event.Event) error {
	if b.closed.Load() {
		return nil
	}

	b.mu.RLock()
	subs := make([]*subscription, len(b.subscribers))
	copy(subs, b.subscribers)
	b.mu.RUnlock()

	// Синхронный fan-out: проверяем фильтры и отправляем в очереди подписчиков
	for _, sub := range subs {
		if sub.filter.Matches(e) {
			if !sub.send(e) {
				b.totalDropped.Add(1)
			}
		}
	}

	b.totalPublished.Add(1)
	return nil
}

// PublishBatch публикует несколько событий за один вызов.
func (b *bus) PublishBatch(ctx context.Context, events []*event.Event) (int, error) {
	if b.closed.Load() {
		return 0, nil
	}

	b.mu.RLock()
	subs := make([]*subscription, len(b.subscribers))
	copy(subs, b.subscribers)
	b.mu.RUnlock()

	published := 0
	for _, e := range events {
		// Синхронный fan-out для каждого события
		for _, sub := range subs {
			if sub.filter.Matches(e) {
				if !sub.send(e) {
					b.totalDropped.Add(1)
				}
			}
		}
		published++
		b.totalPublished.Add(1)
	}

	return published, nil
}

// Subscribe создаёт подписку с фильтром и параметрами.
func (b *bus) Subscribe(ctx context.Context, filter Filter, opt SubscriptionOptions) (Subscription, error) {
	if b.closed.Load() {
		return nil, nil // TODO: вернуть ошибку
	}

	sub := newSubscription(ctx, filter, opt)

	b.mu.Lock()
	b.subscribers = append(b.subscribers, sub)
	b.mu.Unlock()

	return sub, nil
}

// Stats возвращает статистику EventBus.
func (b *bus) Stats() BusStats {
	b.mu.RLock()
	subsCount := len(b.subscribers)
	b.mu.RUnlock()

	return BusStats{
		SubscribersCount: subsCount,
		TotalPublished:   b.totalPublished.Load(),
		TotalDropped:     b.totalDropped.Load(),
	}
}

// Close закрывает EventBus и все подписки.
func (b *bus) Close() error {
	if b.closed.Swap(true) {
		return nil
	}

	b.mu.Lock()
	subs := b.subscribers
	b.subscribers = nil
	b.mu.Unlock()

	// Закрываем все подписки
	for _, sub := range subs {
		_ = sub.Close()
	}

	return nil
}
