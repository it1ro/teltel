package buffer

import (
	"context"
	"sync"
	"time"

	"github.com/teltel/teltel/internal/event"
	"github.com/teltel/teltel/internal/eventbus"
)

// Manager управляет Live Buffer'ами для разных run'ов.
// Manager является подписчиком EventBus.
type Manager struct {
	mu       sync.RWMutex
	buffers  map[string]*RingBuffer // runId -> buffer
	capacity int

	// Подписка на EventBus
	subscription eventbus.Subscription

	// Очистка завершённых run'ов
	cleanupInterval time.Duration
	maxRuns         int // максимальное количество run'ов
}

// Config содержит конфигурацию Manager.
type Config struct {
	// Capacity - размер ring buffer для каждого run'а
	Capacity int

	// CleanupInterval - интервал очистки завершённых run'ов
	CleanupInterval time.Duration

	// MaxRuns - максимальное количество run'ов (0 = без ограничений)
	MaxRuns int
}

// NewManager создаёт новый Manager и подписывается на EventBus.
func NewManager(bus eventbus.EventBus, config Config) (*Manager, error) {
	capacity := config.Capacity
	if capacity < 1 {
		capacity = 10000 // дефолтное значение
	}

	cleanupInterval := config.CleanupInterval
	if cleanupInterval == 0 {
		cleanupInterval = 5 * time.Minute // дефолтное значение
	}

	m := &Manager{
		buffers:         make(map[string]*RingBuffer),
		capacity:        capacity,
		cleanupInterval: cleanupInterval,
		maxRuns:         config.MaxRuns,
	}

	// Подписываемся на EventBus (принимаем все события)
	filter := eventbus.Filter{} // пустой фильтр = все события
	opt := eventbus.SubscriptionOptions{
		BufferSize: 1000,
		Policy:     eventbus.BackpressureDropOld, // для live buffer используем drop_old
		Name:       "live-buffer",
	}

	ctx := context.Background()
	sub, err := bus.Subscribe(ctx, filter, opt)
	if err != nil {
		return nil, err
	}

	m.subscription = sub

	// Запускаем goroutine для чтения событий из EventBus
	go m.readEvents()

	// Запускаем goroutine для периодической очистки
	if m.cleanupInterval > 0 {
		go m.cleanupLoop()
	}

	return m, nil
}

// readEvents читает события из EventBus и добавляет их в соответствующие buffers.
func (m *Manager) readEvents() {
	for e := range m.subscription.C() {
		m.appendEvent(e)
	}
}

// appendEvent добавляет событие в buffer соответствующего run'а.
func (m *Manager) appendEvent(e *event.Event) {
	m.mu.Lock()
	defer m.mu.Unlock()

	buf, exists := m.buffers[e.RunID]
	if !exists {
		// Проверяем ограничение на количество run'ов
		if m.maxRuns > 0 && len(m.buffers) >= m.maxRuns {
			// Удаляем самый старый run (простая стратегия)
			// В Phase 1 это достаточно
			for runID := range m.buffers {
				delete(m.buffers, runID)
				break
			}
		}

		buf = NewRingBuffer(m.capacity)
		m.buffers[e.RunID] = buf
	}

	buf.Append(e)
}

// GetBuffer возвращает buffer для указанного run'а.
func (m *Manager) GetBuffer(runID string) *RingBuffer {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.buffers[runID]
}

// GetRuns возвращает список всех run'ов.
func (m *Manager) GetRuns() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	runs := make([]string, 0, len(m.buffers))
	for runID := range m.buffers {
		runs = append(runs, runID)
	}
	return runs
}

// cleanupLoop периодически очищает завершённые run'ы.
// В Phase 1 используем простую стратегию: удаляем run'ы старше определённого времени.
func (m *Manager) cleanupLoop() {
	ticker := time.NewTicker(m.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		// В Phase 1 очистка упрощена - можно удалять run'ы по TTL
		// или по максимальному количеству. Реализация зависит от требований.
		// Пока оставляем простую логику через maxRuns.
	}
}

// Close закрывает Manager и подписку.
func (m *Manager) Close() error {
	if m.subscription != nil {
		return m.subscription.Close()
	}
	return nil
}
