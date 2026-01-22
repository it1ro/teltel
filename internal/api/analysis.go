package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/teltel/teltel/internal/storage"
)

// AnalysisHandler обрабатывает HTTP запросы для post-run анализа.
// Все данные загружаются только из ClickHouse через SQL helpers.
type AnalysisHandler struct {
	client storage.Client
}

// NewAnalysisHandler создаёт новый Analysis handler.
func NewAnalysisHandler(client storage.Client) *AnalysisHandler {
	return &AnalysisHandler{
		client: client,
	}
}

// HandleRuns возвращает список завершённых run'ов из run_metadata.
// GET /api/analysis/runs
// Query params (опционально):
//   - sourceId: фильтр по source_id
//   - status: фильтр по статусу (completed, failed, cancelled)
//   - daysBack: количество дней назад (по умолчанию 30)
func (h *AnalysisHandler) HandleRuns(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Параметры запроса
	sourceID := r.URL.Query().Get("sourceId")
	status := r.URL.Query().Get("status")
	daysBack := 30
	if daysBackStr := r.URL.Query().Get("daysBack"); daysBackStr != "" {
		if _, err := fmt.Sscanf(daysBackStr, "%d", &daysBack); err != nil {
			http.Error(w, "Invalid daysBack parameter", http.StatusBadRequest)
			return
		}
	}

	// Формируем SQL запрос
	var query string
	if sourceID != "" && status != "" {
		query = storage.GetRunsByMetadataQuery(sourceID, status, daysBack)
	} else {
		// Простой запрос для всех run'ов
		query = fmt.Sprintf(`
SELECT
  run_id,
  started_at,
  ended_at,
  status,
  total_events,
  total_frames,
  engine_version,
  source_id
FROM run_metadata
WHERE started_at >= now() - INTERVAL %d DAY
ORDER BY started_at DESC;
`, daysBack)
	}

	// Выполняем запрос
	ctx := r.Context()
	jsonData, err := h.client.Query(ctx, query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Возвращаем raw JSON (JSONEachRow формат)
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonData)
}

// HandleRun возвращает метаданные конкретного run'а.
// GET /api/analysis/run/{runId}
func (h *AnalysisHandler) HandleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Извлекаем runId из пути
	path := strings.TrimPrefix(r.URL.Path, "/api/analysis/run/")
	runID := strings.TrimSpace(path)
	if runID == "" {
		http.Error(w, "Missing runId in path", http.StatusBadRequest)
		return
	}

	// SQL запрос для метаданных run'а
	query := fmt.Sprintf(`
SELECT
  run_id,
  started_at,
  ended_at,
  duration_seconds,
  status,
  total_events,
  total_frames,
  max_frame_index,
  source_id,
  config,
  engine_version,
  seed,
  end_reason,
  tags
FROM run_metadata
WHERE run_id = '%s';
`, runID)

	// Выполняем запрос
	ctx := r.Context()
	jsonData, err := h.client.Query(ctx, query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Если результат пустой, run не найден
	if len(jsonData) == 0 || string(jsonData) == "" {
		http.Error(w, "Run not found", http.StatusNotFound)
		return
	}

	// Возвращаем raw JSON
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonData)
}

// HandleSeries возвращает временной ряд для run'а.
// GET /api/analysis/series
// Query params:
//   - runId: идентификатор run'а (обязательно)
//   - eventType: тип события (обязательно)
//   - sourceId: источник события (обязательно)
//   - jsonPath: путь к значению в payload (обязательно)
func (h *AnalysisHandler) HandleSeries(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Параметры запроса
	runID := r.URL.Query().Get("runId")
	eventType := r.URL.Query().Get("eventType")
	sourceID := r.URL.Query().Get("sourceId")
	jsonPath := r.URL.Query().Get("jsonPath")

	if runID == "" || eventType == "" || sourceID == "" || jsonPath == "" {
		http.Error(w, "Missing required parameters: runId, eventType, sourceId, jsonPath", http.StatusBadRequest)
		return
	}

	// Используем SQL helper
	query := storage.GetSeriesQuery(runID, eventType, sourceID, jsonPath)

	// Выполняем запрос
	ctx := r.Context()
	jsonData, err := h.client.Query(ctx, query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Возвращаем raw JSON
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonData)
}

// HandleCompare сравнивает два run'а.
// GET /api/analysis/compare
// Query params:
//   - runId1: первый run (обязательно)
//   - runId2: второй run (обязательно)
//   - eventType: тип события (обязательно)
//   - sourceId: источник события (обязательно)
//   - jsonPath: путь к значению в payload (обязательно)
func (h *AnalysisHandler) HandleCompare(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Параметры запроса
	runID1 := r.URL.Query().Get("runId1")
	runID2 := r.URL.Query().Get("runId2")
	eventType := r.URL.Query().Get("eventType")
	sourceID := r.URL.Query().Get("sourceId")
	jsonPath := r.URL.Query().Get("jsonPath")

	if runID1 == "" || runID2 == "" || eventType == "" || sourceID == "" || jsonPath == "" {
		http.Error(w, "Missing required parameters: runId1, runId2, eventType, sourceId, jsonPath", http.StatusBadRequest)
		return
	}

	// Используем SQL helper
	query := storage.GetCompareRunsQuery(runID1, runID2, eventType, sourceID, jsonPath)

	// Выполняем запрос
	ctx := r.Context()
	jsonData, err := h.client.Query(ctx, query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Возвращаем raw JSON
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonData)
}

// QueryRequest представляет запрос на выполнение SQL.
type QueryRequest struct {
	Query string `json:"query"`
}

// HandleQuery выполняет произвольный SELECT запрос.
// POST /api/analysis/query
// Body: {"query": "SELECT ..."}
// Принимает ТОЛЬКО SELECT запросы (проверка по префиксу).
func (h *AnalysisHandler) HandleQuery(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Парсим запрос
	var req QueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// Проверяем, что это SELECT запрос
	queryUpper := strings.TrimSpace(strings.ToUpper(req.Query))
	if !strings.HasPrefix(queryUpper, "SELECT") {
		http.Error(w, "Only SELECT queries are allowed", http.StatusBadRequest)
		return
	}

	// Выполняем запрос
	ctx := r.Context()
	jsonData, err := h.client.Query(ctx, req.Query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Query failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Возвращаем raw JSON
	w.Header().Set("Content-Type", "application/json")
	w.Write(jsonData)
}
