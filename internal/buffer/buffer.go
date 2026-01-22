package buffer

import (
	"sync"

	"github.com/teltel/teltel/internal/event"
)

// RingBuffer представляет ring buffer для событий одного run'а.
type RingBuffer struct {
	mu       sync.RWMutex
	events   []*event.Event
	capacity int
	size     int
	head     int // индекс для следующей записи
}

// NewRingBuffer создаёт новый ring buffer с заданной ёмкостью.
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity < 1 {
		capacity = 1
	}
	return &RingBuffer{
		events:   make([]*event.Event, capacity),
		capacity: capacity,
		size:     0,
		head:     0,
	}
}

// Append добавляет событие в ring buffer.
// Если buffer полон, перезаписывает самое старое событие.
func (rb *RingBuffer) Append(e *event.Event) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.events[rb.head] = e
	rb.head = (rb.head + 1) % rb.capacity

	if rb.size < rb.capacity {
		rb.size++
	}
}

// Tail возвращает последние N событий.
// Если событий меньше N, возвращает все доступные.
func (rb *RingBuffer) Tail(n int) []*event.Event {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if n <= 0 || rb.size == 0 {
		return nil
	}

	if n > rb.size {
		n = rb.size
	}

	result := make([]*event.Event, 0, n)

	// Начинаем с head и идём назад
	start := (rb.head - n + rb.capacity) % rb.capacity
	if rb.size < rb.capacity {
		// Buffer ещё не заполнен, начинаем с 0
		start = 0
		n = rb.size
	}

	for i := 0; i < n; i++ {
		idx := (start + i) % rb.capacity
		if rb.events[idx] != nil {
			result = append(result, rb.events[idx])
		}
	}

	return result
}

// Get возвращает событие по frameIndex, если оно есть в buffer.
// Возвращает nil, если событие не найдено.
func (rb *RingBuffer) Get(frameIndex int) *event.Event {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	for i := 0; i < rb.size; i++ {
		idx := (rb.head - rb.size + i + rb.capacity) % rb.capacity
		if rb.events[idx] != nil && rb.events[idx].FrameIndex == frameIndex {
			return rb.events[idx]
		}
	}

	return nil
}

// Size возвращает текущий размер buffer.
func (rb *RingBuffer) Size() int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()
	return rb.size
}

// Clear очищает buffer.
func (rb *RingBuffer) Clear() {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	rb.events = make([]*event.Event, rb.capacity)
	rb.size = 0
	rb.head = 0
}
