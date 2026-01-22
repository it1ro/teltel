package ingest

import (
	"bufio"
	"io"
	"net/http"

	"github.com/teltel/teltel/internal/event"
	"github.com/teltel/teltel/internal/eventbus"
)

// Handler обрабатывает HTTP запросы для ingest endpoint.
type Handler struct {
	bus eventbus.EventBus
}

// NewHandler создаёт новый ingest handler.
func NewHandler(bus eventbus.EventBus) *Handler {
	return &Handler{
		bus: bus,
	}
}

// HandleIngest обрабатывает POST /api/ingest запрос с NDJSON потоком.
// Каждая строка обрабатывается независимо.
// Ошибка в одной строке не ломает обработку остальных.
func (h *Handler) HandleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := r.Context()
	scanner := bufio.NewScanner(r.Body)
	batch := make([]*event.Event, 0, 100) // начальный размер batch
	batchSize := 100

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// Парсим строку NDJSON
		evt, err := event.ParseNDJSONLine(line)
		if err != nil {
			// Ошибка парсинга - пропускаем строку, продолжаем обработку
			continue
		}

		// Устанавливаем wallTime, если не задано
		evt.SetWallTime()

		batch = append(batch, evt)

		// Публикуем batch при достижении размера
		if len(batch) >= batchSize {
			_, _ = h.bus.PublishBatch(ctx, batch)
			batch = batch[:0] // очищаем, сохраняя capacity
		}
	}

	// Публикуем оставшиеся события
	if len(batch) > 0 {
		_, _ = h.bus.PublishBatch(ctx, batch)
	}

	// Проверяем ошибки сканера (не ошибки парсинга отдельных строк)
	if err := scanner.Err(); err != nil && err != io.EOF {
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}
