package eventbus

import (
	"context"
	"sync"
	"sync/atomic"

	"github.com/teltel/teltel/internal/event"
)

// subscription реализует Subscription интерфейс.
type subscription struct {
	filter  Filter
	options SubscriptionOptions
	ch      chan *event.Event
	ctx     context.Context
	cancel  context.CancelFunc

	dropped atomic.Uint64
	closed  atomic.Bool
	wg      sync.WaitGroup
}

// newSubscription создаёт новую подписку.
func newSubscription(ctx context.Context, filter Filter, opt SubscriptionOptions) *subscription {
	subCtx, cancel := context.WithCancel(ctx)

	// Минимальный размер буфера - 1
	bufferSize := opt.BufferSize
	if bufferSize < 1 {
		bufferSize = 1
	}

	sub := &subscription{
		filter:  filter,
		options: opt,
		ch:      make(chan *event.Event, bufferSize),
		ctx:     subCtx,
		cancel:  cancel,
	}

	return sub
}

// C возвращает канал для чтения событий.
func (s *subscription) C() <-chan *event.Event {
	return s.ch
}

// Dropped возвращает количество отброшенных событий.
func (s *subscription) Dropped() uint64 {
	return s.dropped.Load()
}

// Close закрывает подписку.
func (s *subscription) Close() error {
	if s.closed.Swap(true) {
		return nil // уже закрыта
	}

	s.cancel()
	close(s.ch)
	s.wg.Wait()
	return nil
}

// send пытается отправить событие в очередь подписки.
// Возвращает true, если событие отправлено, false если отброшено.
func (s *subscription) send(e *event.Event) bool {
	if s.closed.Load() {
		return false
	}

	switch s.options.Policy {
	case BackpressureBlock:
		// Блокируемся, пока не освободится место
		select {
		case s.ch <- e:
			return true
		case <-s.ctx.Done():
			return false
		}

	case BackpressureDropNew:
		// Отбрасываем новое событие, если очередь полна
		select {
		case s.ch <- e:
			return true
		default:
			s.dropped.Add(1)
			return false
		}

	case BackpressureDropOld:
		// Удаляем старое событие, если очередь полна (ring buffer)
		select {
		case s.ch <- e:
			return true
		default:
			// Пытаемся удалить одно старое событие
			select {
			case <-s.ch:
				s.dropped.Add(1)
				// Теперь пробуем отправить новое
				select {
				case s.ch <- e:
					return true
				default:
					s.dropped.Add(1)
					return false
				}
			default:
				// Не удалось удалить старое, отбрасываем новое
				s.dropped.Add(1)
				return false
			}
		}

	default:
		// Неизвестная политика, используем drop_new
		select {
		case s.ch <- e:
			return true
		default:
			s.dropped.Add(1)
			return false
		}
	}
}
