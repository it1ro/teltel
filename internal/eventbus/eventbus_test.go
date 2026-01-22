package eventbus

import (
	"context"
	"testing"
	"time"

	"github.com/teltel/teltel/internal/event"
)

// makeEvent создаёт тестовое событие с указанными параметрами.
func makeEvent(runID, sourceID, channel, eventType string, tags map[string]string) *event.Event {
	e := &event.Event{
		V:          1,
		RunID:      runID,
		SourceID:   sourceID,
		Channel:    channel,
		Type:       eventType,
		FrameIndex: 0,
		SimTime:    0.0,
		Payload:    []byte(`{}`),
	}
	if tags != nil {
		e.Tags = tags
	}
	return e
}

// readEvents читает строго N событий из подписки с таймаутом.
// Возвращает прочитанные события (может быть меньше N, если таймаут истёк).
func readEvents(sub Subscription, count int, timeout time.Duration) []*event.Event {
	var events []*event.Event
	deadline := time.After(timeout)
	for len(events) < count {
		select {
		case e, ok := <-sub.C():
			if !ok {
				return events // канал закрыт
			}
			events = append(events, e)
		case <-deadline:
			return events // таймаут
		}
	}
	return events
}

// readAllAvailableEvents читает все доступные события из подписки до таймаута.
func readAllAvailableEvents(sub Subscription, timeout time.Duration) []*event.Event {
	var events []*event.Event
	deadline := time.After(timeout)
	for {
		select {
		case e, ok := <-sub.C():
			if !ok {
				return events // канал закрыт
			}
			events = append(events, e)
		case <-deadline:
			return events // таймаут
		}
	}
}

// TestEventBus_Publish проверяет базовую функциональность Publish.
func TestEventBus_Publish(t *testing.T) {
	t.Run("одно событие доставляется подписчику", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, err := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		if err != nil {
			t.Fatalf("Subscribe() вернула ошибку: %v", err)
		}
		defer sub.Close()

		e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		if err := bus.Publish(ctx, e); err != nil {
			t.Fatalf("Publish() вернула ошибку: %v", err)
		}

		received := readEvents(sub, 1, 100*time.Millisecond)
		if len(received) != 1 {
			t.Fatalf("ожидалось 1 событие, получено %d", len(received))
		}
		if received[0] != e {
			t.Error("получено событие не совпадает с отправленным")
		}
	})

	t.Run("событие доставляется нескольким подписчикам", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub1, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		defer sub1.Close()

		sub2, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		defer sub2.Close()

		e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		if err := bus.Publish(ctx, e); err != nil {
			t.Fatalf("Publish() вернула ошибку: %v", err)
		}

		received1 := readEvents(sub1, 1, 100*time.Millisecond)
		received2 := readEvents(sub2, 1, 100*time.Millisecond)

		if len(received1) != 1 {
			t.Errorf("подписчик 1: ожидалось 1 событие, получено %d", len(received1))
		}
		if len(received2) != 1 {
			t.Errorf("подписчик 2: ожидалось 1 событие, получено %d", len(received2))
		}
	})

	t.Run("событие не доставляется при несовпадении фильтра", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{
			RunID: "run-2",
		}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		defer sub.Close()

		e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		if err := bus.Publish(ctx, e); err != nil {
			t.Fatalf("Publish() вернула ошибку: %v", err)
		}

		// Проверяем, что событие не доставлено (читаем с коротким таймаутом)
		received := readEvents(sub, 1, 50*time.Millisecond)
		if len(received) != 0 {
			t.Errorf("ожидалось 0 событий, получено %d", len(received))
		}
	})
}

// TestEventBus_PublishBatch проверяет функциональность PublishBatch.
func TestEventBus_PublishBatch(t *testing.T) {
	t.Run("все события доставляются в правильном порядке", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 100,
			Policy:     BackpressureBlock,
		})
		defer sub.Close()

		events := []*event.Event{
			makeEvent("run-1", "source-1", "channel-1", "type-1", nil),
			makeEvent("run-1", "source-1", "channel-1", "type-2", nil),
			makeEvent("run-1", "source-1", "channel-1", "type-3", nil),
		}

		count, err := bus.PublishBatch(ctx, events)
		if err != nil {
			t.Fatalf("PublishBatch() вернула ошибку: %v", err)
		}
		if count != len(events) {
			t.Errorf("PublishBatch() вернула count=%d, ожидалось %d", count, len(events))
		}

		received := readEvents(sub, len(events), 200*time.Millisecond)
		if len(received) != len(events) {
			t.Fatalf("ожидалось %d событий, получено %d", len(events), len(received))
		}

		// Проверяем порядок
		for i := 0; i < len(events); i++ {
			if received[i].Type != events[i].Type {
				t.Errorf("событие %d: ожидался тип %q, получен %q", i, events[i].Type, received[i].Type)
			}
		}
	})

	t.Run("пустой batch не вызывает ошибку", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		count, err := bus.PublishBatch(ctx, []*event.Event{})
		if err != nil {
			t.Fatalf("PublishBatch() вернула ошибку для пустого batch: %v", err)
		}
		if count != 0 {
			t.Errorf("PublishBatch() вернула count=%d для пустого batch, ожидалось 0", count)
		}
	})

	t.Run("batch доставляется нескольким подписчикам", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub1, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 100,
			Policy:     BackpressureBlock,
		})
		defer sub1.Close()

		sub2, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 100,
			Policy:     BackpressureBlock,
		})
		defer sub2.Close()

		events := []*event.Event{
			makeEvent("run-1", "source-1", "channel-1", "type-1", nil),
			makeEvent("run-1", "source-1", "channel-1", "type-2", nil),
		}

		if _, err := bus.PublishBatch(ctx, events); err != nil {
			t.Fatalf("PublishBatch() вернула ошибку: %v", err)
		}

		received1 := readEvents(sub1, len(events), 200*time.Millisecond)
		received2 := readEvents(sub2, len(events), 200*time.Millisecond)

		if len(received1) != len(events) {
			t.Errorf("подписчик 1: ожидалось %d событий, получено %d", len(events), len(received1))
		}
		if len(received2) != len(events) {
			t.Errorf("подписчик 2: ожидалось %d событий, получено %d", len(events), len(received2))
		}
	})
}

// TestFilter_Matches проверяет фильтрацию событий.
func TestFilter_Matches(t *testing.T) {
	t.Run("RunID фильтр", func(t *testing.T) {
		filter := Filter{RunID: "run-1"}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-2", "source-1", "channel-1", "type-1", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с событием с тем же RunID")
		}
		if filter.Matches(e2) {
			t.Error("фильтр не должен совпадать с событием с другим RunID")
		}
	})

	t.Run("пустой RunID = wildcard", func(t *testing.T) {
		filter := Filter{RunID: ""}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-2", "source-1", "channel-1", "type-1", nil)

		if !filter.Matches(e1) {
			t.Error("пустой RunID должен совпадать с любым событием")
		}
		if !filter.Matches(e2) {
			t.Error("пустой RunID должен совпадать с любым событием")
		}
	})

	t.Run("SourceID фильтр", func(t *testing.T) {
		filter := Filter{SourceID: "source-1"}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-2", "channel-1", "type-1", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с событием с тем же SourceID")
		}
		if filter.Matches(e2) {
			t.Error("фильтр не должен совпадать с событием с другим SourceID")
		}
	})

	t.Run("Channel фильтр", func(t *testing.T) {
		filter := Filter{Channel: "channel-1"}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-2", "type-1", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с событием с тем же Channel")
		}
		if filter.Matches(e2) {
			t.Error("фильтр не должен совпадать с событием с другим Channel")
		}
	})

	t.Run("Types фильтр - точное совпадение", func(t *testing.T) {
		filter := Filter{Types: []string{"type-1", "type-2"}}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-3", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с type-1")
		}
		if !filter.Matches(e2) {
			t.Error("фильтр должен совпадать с type-2")
		}
		if filter.Matches(e3) {
			t.Error("фильтр не должен совпадать с type-3")
		}
	})

	t.Run("TypePrefix фильтр", func(t *testing.T) {
		filter := Filter{TypePrefix: "frame."}
		e1 := makeEvent("run-1", "source-1", "channel-1", "frame.start", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "frame.end", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "body.state", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с frame.start")
		}
		if !filter.Matches(e2) {
			t.Error("фильтр должен совпадать с frame.end")
		}
		if filter.Matches(e3) {
			t.Error("фильтр не должен совпадать с body.state")
		}
	})

	t.Run("TagsAll фильтр", func(t *testing.T) {
		filter := Filter{
			TagsAll: map[string]string{
				"env":  "prod",
				"zone": "us-east",
			},
		}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", map[string]string{
			"env":  "prod",
			"zone": "us-east",
		})
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-1", map[string]string{
			"env": "prod",
		})
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с событием, содержащим все теги")
		}
		if filter.Matches(e2) {
			t.Error("фильтр не должен совпадать с событием без всех тегов")
		}
		if filter.Matches(e3) {
			t.Error("фильтр не должен совпадать с событием без тегов")
		}
	})

	t.Run("комбинация фильтров", func(t *testing.T) {
		filter := Filter{
			RunID:    "run-1",
			SourceID: "source-1",
			Channel:  "channel-1",
			Types:    []string{"type-1"},
		}
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-2", "source-1", "channel-1", "type-1", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)

		if !filter.Matches(e1) {
			t.Error("фильтр должен совпадать с событием, удовлетворяющим всем условиям")
		}
		if filter.Matches(e2) {
			t.Error("фильтр не должен совпадать с событием с другим RunID")
		}
		if filter.Matches(e3) {
			t.Error("фильтр не должен совпадать с событием с другим Type")
		}
	})
}

// TestBackpressure_Block проверяет политику backpressure "block".
func TestBackpressure_Block(t *testing.T) {
	t.Run("Publish блокируется при заполненной очереди", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureBlock,
		})
		defer sub.Close()

		// Заполняем очередь
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-3", nil)

		bus.Publish(ctx, e1)
		bus.Publish(ctx, e2)

		// Третье событие должно заблокироваться, если не читать из очереди
		publishDone := make(chan bool)
		go func() {
			err := bus.Publish(ctx, e3)
			publishDone <- (err == nil)
		}()

		// Даём время на блокировку
		select {
		case <-publishDone:
			t.Error("Publish не должен завершиться сразу при заполненной очереди")
		case <-time.After(50 * time.Millisecond):
			// Ожидаемое поведение - блокировка
		}

		// Освобождаем место, читая одно событие
		<-sub.C()

		// Теперь Publish должен завершиться
		select {
		case success := <-publishDone:
			if !success {
				t.Error("Publish должен завершиться успешно после освобождения места")
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("Publish должен завершиться после освобождения места")
		}
	})

	t.Run("все события доставляются при block политике", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 5,
			Policy:     BackpressureBlock,
		})
		defer sub.Close()

		// Запускаем reader goroutine, которая будет читать события параллельно с публикацией
		received := make(chan *event.Event, 20)
		readerDone := make(chan struct{})
		go func() {
			defer close(readerDone)
			for e := range sub.C() {
				received <- e
			}
		}()

		// Публикуем больше, чем размер буфера
		// Reader будет читать события параллельно, освобождая место в очереди
		for i := 0; i < 10; i++ {
			e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
			if err := bus.Publish(ctx, e); err != nil {
				t.Fatalf("Publish() вернула ошибку: %v", err)
			}
		}

		// Закрываем подписку, чтобы reader завершился
		sub.Close()

		// Собираем все прочитанные события
		var events []*event.Event
		timeout := time.After(500 * time.Millisecond)
	collectLoop:
		for len(events) < 10 {
			select {
			case e, ok := <-received:
				if !ok {
					break collectLoop
				}
				events = append(events, e)
			case <-readerDone:
				// Reader завершился, собираем оставшиеся события
				for {
					select {
					case e := <-received:
						events = append(events, e)
					default:
						break collectLoop
					}
				}
			case <-timeout:
				t.Fatalf("получено только %d из 10 событий", len(events))
			}
		}

		if len(events) != 10 {
			t.Fatalf("ожидалось 10 событий, получено %d", len(events))
		}

		if sub.Dropped() != 0 {
			t.Errorf("ожидалось 0 отброшенных событий, получено %d", sub.Dropped())
		}
	})
}

// TestBackpressure_DropNew проверяет политику backpressure "drop_new".
func TestBackpressure_DropNew(t *testing.T) {
	t.Run("новые события отбрасываются при заполненной очереди", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureDropNew,
		})
		defer sub.Close()

		// Заполняем очередь
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-3", nil)
		e4 := makeEvent("run-1", "source-1", "channel-1", "type-4", nil)

		bus.Publish(ctx, e1)
		bus.Publish(ctx, e2)
		bus.Publish(ctx, e3) // должно отброситься
		bus.Publish(ctx, e4) // должно отброситься

		// Читаем события (должно быть только 2)
		received := readEvents(sub, 2, 100*time.Millisecond)
		if len(received) != 2 {
			t.Errorf("ожидалось 2 события, получено %d", len(received))
		}

		// Проверяем, что отброшено правильное количество
		if sub.Dropped() < 2 {
			t.Errorf("ожидалось минимум 2 отброшенных события, получено %d", sub.Dropped())
		}
	})

	t.Run("Publish не блокируется при drop_new", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 1,
			Policy:     BackpressureDropNew,
		})
		defer sub.Close()

		// Заполняем очередь
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)

		bus.Publish(ctx, e1)

		// Второе событие должно отброситься без блокировки
		start := time.Now()
		bus.Publish(ctx, e2)
		duration := time.Since(start)

		if duration > 10*time.Millisecond {
			t.Errorf("Publish заблокировался на %v, не должен блокироваться", duration)
		}

		if sub.Dropped() == 0 {
			t.Error("ожидалось отброшенное событие")
		}
	})
}

// TestBackpressure_DropOld проверяет политику backpressure "drop_old".
func TestBackpressure_DropOld(t *testing.T) {
	t.Run("старые события удаляются при переполнении", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureDropOld,
		})
		defer sub.Close()

		// Публикуем больше, чем размер буфера
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)
		e3 := makeEvent("run-1", "source-1", "channel-1", "type-3", nil)
		e4 := makeEvent("run-1", "source-1", "channel-1", "type-4", nil)

		bus.Publish(ctx, e1)
		bus.Publish(ctx, e2)
		bus.Publish(ctx, e3) // должно вытеснить e1
		bus.Publish(ctx, e4) // должно вытеснить e2

		// Читаем события - должны получить последние (2 события)
		received := readEvents(sub, 2, 100*time.Millisecond)
		if len(received) != 2 {
			t.Errorf("ожидалось 2 события, получено %d", len(received))
		}

		// Проверяем, что получили последние события
		if received[0].Type != "type-3" && received[0].Type != "type-4" {
			t.Errorf("получено старое событие: %q", received[0].Type)
		}
		if received[1].Type != "type-3" && received[1].Type != "type-4" {
			t.Errorf("получено старое событие: %q", received[1].Type)
		}

		// Должны быть отброшенные события
		if sub.Dropped() == 0 {
			t.Error("ожидались отброшенные события")
		}
	})

	t.Run("Publish не блокируется при drop_old", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 1,
			Policy:     BackpressureDropOld,
		})
		defer sub.Close()

		// Заполняем очередь
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)

		bus.Publish(ctx, e1)

		// Второе событие должно вытеснить первое без блокировки
		start := time.Now()
		bus.Publish(ctx, e2)
		duration := time.Since(start)

		if duration > 10*time.Millisecond {
			t.Errorf("Publish заблокировался на %v, не должен блокироваться", duration)
		}

		// Должно быть отброшено старое событие
		if sub.Dropped() == 0 {
			t.Error("ожидалось отброшенное событие")
		}
	})
}

// TestSubscriberIsolation проверяет изоляцию подписчиков.
func TestSubscriberIsolation(t *testing.T) {
	t.Run("медленный подписчик не блокирует быстрого", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()

		// Медленный подписчик с маленьким буфером и block политикой
		slowSub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 1,
			Policy:     BackpressureBlock,
		})
		defer slowSub.Close()

		// Быстрый подписчик с drop_new политикой
		fastSub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureDropNew,
		})
		defer fastSub.Close()

		// Публикуем событие
		e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		bus.Publish(ctx, e)

		// Быстрый подписчик должен получить событие сразу
		select {
		case received := <-fastSub.C():
			if received != e {
				t.Error("быстрый подписчик получил неверное событие")
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("быстрый подписчик не получил событие")
		}

		// Медленный подписчик тоже должен получить событие
		select {
		case received := <-slowSub.C():
			if received != e {
				t.Error("медленный подписчик получил неверное событие")
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("медленный подписчик не получил событие")
		}
	})

	t.Run("разные политики backpressure не влияют друг на друга", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()

		blockSub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureBlock,
		})
		defer blockSub.Close()

		dropNewSub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureDropNew,
		})
		defer dropNewSub.Close()

		dropOldSub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureDropOld,
		})
		defer dropOldSub.Close()

		// Запускаем reader для block подписки, чтобы избежать блокировки при публикации
		blockReceived := make(chan *event.Event, 10)
		blockReaderDone := make(chan struct{})
		go func() {
			defer close(blockReaderDone)
			for e := range blockSub.C() {
				blockReceived <- e
			}
		}()

		// Публикуем больше событий, чем размер буфера
		// Reader для block подписки будет читать параллельно
		for i := 0; i < 5; i++ {
			e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
			bus.Publish(ctx, e)
		}

		// Закрываем block подписку, чтобы reader завершился
		blockSub.Close()

		// Собираем события из block подписки
		var blockEvents []*event.Event
		timeout := time.After(200 * time.Millisecond)
	collectBlock:
		for len(blockEvents) < 5 {
			select {
			case e, ok := <-blockReceived:
				if !ok {
					break collectBlock
				}
				blockEvents = append(blockEvents, e)
			case <-blockReaderDone:
				// Reader завершился, собираем оставшиеся события
				for {
					select {
					case e := <-blockReceived:
						blockEvents = append(blockEvents, e)
					default:
						break collectBlock
					}
				}
			case <-timeout:
				break collectBlock
			}
		}

		// Каждый подписчик должен иметь свою статистику
		blockDropped := blockSub.Dropped()
		dropNewDropped := dropNewSub.Dropped()
		dropOldDropped := dropOldSub.Dropped()

		// block не должен отбрасывать события (если читать)
		// drop_new и drop_old должны отбрасывать
		if blockDropped != 0 {
			t.Errorf("block политика не должна отбрасывать события, получено %d", blockDropped)
		}
		if dropNewDropped == 0 && dropOldDropped == 0 {
			t.Error("ожидались отброшенные события для drop политик")
		}
	})

	t.Run("закрытие подписки прекращает доставку", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})

		// Публикуем событие
		e1 := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
		bus.Publish(ctx, e1)

		// Получаем событие и убеждаемся, что канал ещё открыт
		received1, ok := <-sub.C()
		if !ok {
			t.Fatal("канал неожиданно закрыт")
		}
		if received1 != e1 {
			t.Error("получено неверное событие")
		}

		// Закрываем подписку
		sub.Close()

		// Публикуем ещё одно событие после закрытия
		e2 := makeEvent("run-1", "source-1", "channel-1", "type-2", nil)
		bus.Publish(ctx, e2)

		// Не должно быть доставлено (канал закрыт, чтение вернёт ok=false)
		select {
		case received2, ok := <-sub.C():
			if ok {
				t.Errorf("событие не должно быть доставлено после закрытия подписки, получено: %v", received2)
			}
			// ok=false - ожидаемое поведение для закрытого канала
		case <-time.After(100 * time.Millisecond):
			// Таймаут тоже нормален, если канал уже закрыт
		}
	})
}

// TestEventBus_Stats проверяет статистику EventBus.
func TestEventBus_Stats(t *testing.T) {
	t.Run("счётчик опубликованных событий", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		stats := bus.Stats()
		if stats.TotalPublished != 0 {
			t.Errorf("начальная статистика: ожидалось 0 опубликованных, получено %d", stats.TotalPublished)
		}

		// Публикуем события
		for i := 0; i < 5; i++ {
			e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
			bus.Publish(ctx, e)
		}

		stats = bus.Stats()
		if stats.TotalPublished != 5 {
			t.Errorf("ожидалось 5 опубликованных событий, получено %d", stats.TotalPublished)
		}
	})

	t.Run("счётчик отброшенных событий", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		sub, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 2,
			Policy:     BackpressureDropNew,
		})
		defer sub.Close()

		// Публикуем больше, чем размер буфера
		for i := 0; i < 5; i++ {
			e := makeEvent("run-1", "source-1", "channel-1", "type-1", nil)
			bus.Publish(ctx, e)
		}

		// Читаем доступные события, чтобы освободить очередь
		readAllAvailableEvents(sub, 100*time.Millisecond)

		stats := bus.Stats()
		if stats.TotalDropped == 0 {
			t.Error("ожидались отброшенные события в статистике bus")
		}

		// Проверяем, что статистика подписки соответствует статистике bus
		subDropped := sub.Dropped()
		if subDropped == 0 {
			t.Error("ожидались отброшенные события в статистике подписки")
		}
	})

	t.Run("количество подписчиков", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()

		stats := bus.Stats()
		if stats.SubscribersCount != 0 {
			t.Errorf("начальная статистика: ожидалось 0 подписчиков, получено %d", stats.SubscribersCount)
		}

		sub1, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		defer sub1.Close()

		stats = bus.Stats()
		if stats.SubscribersCount != 1 {
			t.Errorf("ожидалось 1 подписчик, получено %d", stats.SubscribersCount)
		}

		sub2, _ := bus.Subscribe(ctx, Filter{}, SubscriptionOptions{
			BufferSize: 10,
			Policy:     BackpressureBlock,
		})
		defer sub2.Close()

		stats = bus.Stats()
		if stats.SubscribersCount != 2 {
			t.Errorf("ожидалось 2 подписчика, получено %d", stats.SubscribersCount)
		}

		sub1.Close()
		stats = bus.Stats()
		if stats.SubscribersCount != 2 {
			t.Errorf("после закрытия подписки ожидалось 2 подписчика (подписки не удаляются), получено %d", stats.SubscribersCount)
		}
	})

	t.Run("PublishBatch увеличивает счётчик правильно", func(t *testing.T) {
		bus := New()
		defer bus.Close()

		ctx := context.Background()
		events := []*event.Event{
			makeEvent("run-1", "source-1", "channel-1", "type-1", nil),
			makeEvent("run-1", "source-1", "channel-1", "type-2", nil),
			makeEvent("run-1", "source-1", "channel-1", "type-3", nil),
		}

		bus.PublishBatch(ctx, events)

		stats := bus.Stats()
		if stats.TotalPublished != uint64(len(events)) {
			t.Errorf("ожидалось %d опубликованных событий, получено %d", len(events), stats.TotalPublished)
		}
	})
}
