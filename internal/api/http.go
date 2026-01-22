package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/teltel/teltel/internal/buffer"
)

// HTTPHandler обрабатывает HTTP запросы для API.
type HTTPHandler struct {
	bufferManager *buffer.Manager
}

// NewHTTPHandler создаёт новый HTTP handler.
func NewHTTPHandler(bufferManager *buffer.Manager) *HTTPHandler {
	return &HTTPHandler{
		bufferManager: bufferManager,
	}
}

// RunInfo представляет метаданные run'а.
type RunInfo struct {
	RunID    string    `json:"runId"`
	SourceID string    `json:"sourceId,omitempty"`
	Size     int       `json:"size"`     // количество событий в buffer
	Created  time.Time `json:"created"` // время создания (упрощённо)
}

// HandleRuns возвращает список всех run'ов.
func (h *HTTPHandler) HandleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	runs := h.bufferManager.GetRuns()
	runInfos := make([]RunInfo, 0, len(runs))

	for _, runID := range runs {
		buf := h.bufferManager.GetBuffer(runID)
		if buf == nil {
			continue
		}

		// Получаем первое событие для sourceId
		events := buf.Tail(1)
		sourceID := ""
		if len(events) > 0 && events[0] != nil {
			sourceID = events[0].SourceID
		}

		runInfos = append(runInfos, RunInfo{
			RunID:    runID,
			SourceID: sourceID,
			Size:     buf.Size(),
			Created:  time.Now(), // В Phase 1 упрощённо
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(runInfos)
}

// HandleRun возвращает метаданные конкретного run'а.
func (h *HTTPHandler) HandleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	runID := r.URL.Query().Get("runId")
	if runID == "" {
		http.Error(w, "Missing runId parameter", http.StatusBadRequest)
		return
	}

	buf := h.bufferManager.GetBuffer(runID)
	if buf == nil {
		http.Error(w, "Run not found", http.StatusNotFound)
		return
	}

	events := buf.Tail(1)
	sourceID := ""
	if len(events) > 0 && events[0] != nil {
		sourceID = events[0].SourceID
	}

	runInfo := RunInfo{
		RunID:    runID,
		SourceID: sourceID,
		Size:     buf.Size(),
		Created:  time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(runInfo)
}

// HandleHealth возвращает health check статус.
func (h *HTTPHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}
