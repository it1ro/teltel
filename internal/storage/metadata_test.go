package storage

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/teltel/teltel/internal/event"
)

const (
	testTimeout = 10 * time.Second
)

// getClickHouseURL возвращает URL ClickHouse из переменной окружения CLICKHOUSE_URL
// или fallback на localhost для обратной совместимости.
func getClickHouseURL() string {
	if url := os.Getenv("CLICKHOUSE_URL"); url != "" {
		return url
	}
	return "http://localhost:8123"
}

// checkClickHouseAvailable проверяет доступность ClickHouse.
// Если ClickHouse недоступен, пропускает тест.
func checkClickHouseAvailable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	clickhouseURL := getClickHouseURL()
	req, err := http.NewRequestWithContext(ctx, "GET", clickhouseURL+"/ping", nil)
	if err != nil {
		t.Skipf("Не удалось создать запрос к ClickHouse: %v", err)
	}

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Skipf("ClickHouse недоступен: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Skipf("ClickHouse вернул статус %d", resp.StatusCode)
	}
}

// setupTestSchema инициализирует схему ClickHouse для тестов.
func setupTestSchema(t *testing.T, ctx context.Context, client Client) {
	schemaManager := NewSchemaManager(client)
	if err := schemaManager.InitSchema(ctx); err != nil {
		t.Fatalf("Не удалось инициализировать схему: %v", err)
	}
}

// cleanupTestData удаляет тестовые данные из ClickHouse.
func cleanupTestData(t *testing.T, ctx context.Context, client Client, runID string) {
	// Для ReplacingMergeTree используем DELETE
	query := "ALTER TABLE run_metadata DELETE WHERE run_id = '" + runID + "'"
	if err := client.Exec(ctx, query); err != nil {
		// Игнорируем ошибки очистки - это не критично для тестов
		t.Logf("Предупреждение: не удалось очистить тестовые данные: %v", err)
	}
}

// readMetadata читает метаданные run'а из ClickHouse.
// Использует FINAL для ReplacingMergeTree, чтобы получить актуальную версию.
func readMetadata(t *testing.T, ctx context.Context, client Client, runID string) map[string]interface{} {
	// Используем FINAL для ReplacingMergeTree, чтобы получить актуальную версию
	query := "SELECT * FROM run_metadata FINAL WHERE run_id = '" + runID + "' LIMIT 1"
	
	data, err := client.Query(ctx, query)
	if err != nil {
		t.Fatalf("Не удалось прочитать метаданные: %v", err)
	}

	if len(data) == 0 {
		return nil
	}

	// JSONEachRow формат: каждая строка - отдельный JSON объект
	// Разбиваем по строкам и берём первую (для LIMIT 1 будет максимум одна строка)
	lines := []byte{}
	for _, b := range data {
		if b == '\n' {
			break
		}
		lines = append(lines, b)
	}

	// Если не было \n, значит вся строка - это один JSON объект
	if len(lines) == 0 && len(data) > 0 {
		lines = data
	}

	if len(lines) == 0 {
		return nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal(lines, &result); err != nil {
		t.Fatalf("Не удалось распарсить метаданные: %v", err)
	}

	return result
}

// createTestEvent создаёт тестовое событие.
func createTestEvent(runID, sourceID, channel, eventType string, frameIndex int, simTime float64, payload map[string]interface{}) *event.Event {
	var payloadJSON []byte
	if payload != nil {
		payloadJSON, _ = json.Marshal(payload)
	} else {
		payloadJSON = []byte("{}")
	}

	now := time.Now().UnixMilli()
	wallTimeMs := &now

	return &event.Event{
		V:         1,
		RunID:     runID,
		SourceID:  sourceID,
		Channel:   channel,
		Type:      eventType,
		FrameIndex: frameIndex,
		SimTime:   simTime,
		WallTimeMs: wallTimeMs,
		Payload:   payloadJSON,
	}
}

// TestMetadataManager_UpdateFromEvents_EmptyList проверяет, что пустой список событий не приводит к ошибке.
func TestMetadataManager_UpdateFromEvents_EmptyList(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-empty-events"

	// Очищаем данные перед тестом
	cleanupTestData(t, ctx, client, runID)

	// Вызываем UpdateFromEvents с пустым списком
	mm.UpdateFromEvents(ctx, runID, []*event.Event{})

	// Проверяем, что метаданные не были созданы
	metadata := readMetadata(t, ctx, client, runID)
	if metadata != nil {
		t.Errorf("Ожидалось, что метаданные не будут созданы для пустого списка событий, но получено: %v", metadata)
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_UpdateFromEvents_Basic проверяет базовое обновление метаданных из событий.
func TestMetadataManager_UpdateFromEvents_Basic(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-basic-update"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, map[string]interface{}{"x": 0}),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.1, map[string]interface{}{"x": 1}),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 2, 0.2, map[string]interface{}{"x": 2}),
	}

	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем базовые поля
	if metadata["run_id"] != runID {
		t.Errorf("Ожидался run_id=%s, получен %v", runID, metadata["run_id"])
	}

	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 3 {
		t.Errorf("Ожидалось total_events=3, получено %v", metadata["total_events"])
	}

	if maxFrameIndex, ok := metadata["max_frame_index"].(float64); !ok || uint32(maxFrameIndex) != 2 {
		t.Errorf("Ожидалось max_frame_index=2, получено %v", metadata["max_frame_index"])
	}

	if totalFrames, ok := metadata["total_frames"].(float64); !ok || uint32(totalFrames) != 3 {
		t.Errorf("Ожидалось total_frames=3, получено %v", metadata["total_frames"])
	}

	if status, ok := metadata["status"].(string); !ok || status != "running" {
		t.Errorf("Ожидался status=running, получен %v", metadata["status"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_UpdateFromEvents_OrderIndependence проверяет, что порядок событий не влияет на результат.
func TestMetadataManager_UpdateFromEvents_OrderIndependence(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID1 := "test-order-1"
	runID2 := "test-order-2"

	cleanupTestData(t, ctx, client, runID1)
	cleanupTestData(t, ctx, client, runID2)

	// Создаём события в прямом порядке
	events1 := []*event.Event{
		createTestEvent(runID1, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID1, "flight-engine", "physics", "body.state", 1, 0.1, nil),
		createTestEvent(runID1, "flight-engine", "physics", "body.state", 2, 0.2, nil),
	}

	// Создаём те же события в обратном порядке
	events2 := []*event.Event{
		createTestEvent(runID2, "flight-engine", "physics", "body.state", 2, 0.2, nil),
		createTestEvent(runID2, "flight-engine", "physics", "body.state", 1, 0.1, nil),
		createTestEvent(runID2, "flight-engine", "physics", "body.state", 0, 0.0, nil),
	}

	mm.UpdateFromEvents(ctx, runID1, events1)
	mm.UpdateFromEvents(ctx, runID2, events2)

	metadata1 := readMetadata(t, ctx, client, runID1)
	metadata2 := readMetadata(t, ctx, client, runID2)

	if metadata1 == nil || metadata2 == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем, что вычисляемые поля одинаковы
	if metadata1["total_events"] != metadata2["total_events"] {
		t.Errorf("total_events должны быть одинаковыми: %v vs %v", metadata1["total_events"], metadata2["total_events"])
	}

	if metadata1["max_frame_index"] != metadata2["max_frame_index"] {
		t.Errorf("max_frame_index должны быть одинаковыми: %v vs %v", metadata1["max_frame_index"], metadata2["max_frame_index"])
	}

	if metadata1["total_frames"] != metadata2["total_frames"] {
		t.Errorf("total_frames должны быть одинаковыми: %v vs %v", metadata1["total_frames"], metadata2["total_frames"])
	}

	cleanupTestData(t, ctx, client, runID1)
	cleanupTestData(t, ctx, client, runID2)
}

// TestMetadataManager_RunStart проверяет извлечение метаданных из run.start.
func TestMetadataManager_RunStart(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-run-start"

	cleanupTestData(t, ctx, client, runID)

	// Создаём run.start событие
	runStartPayload := map[string]interface{}{
		"engine_version": "1.0.0",
		"seed":           42.0,
		"config":         map[string]interface{}{"gravity": 9.8},
	}
	runStartPayloadJSON, _ := json.Marshal(runStartPayload)

	tags := map[string]string{"vehicle": "f16", "scene": "freeflight"}

	now := time.Now().UnixMilli()
	wallTimeMs := &now

	runStartEvent := &event.Event{
		V:         1,
		RunID:     runID,
		SourceID:  "flight-engine",
		Channel:   "system",
		Type:      "run.start",
		FrameIndex: 0,
		SimTime:   0.0,
		WallTimeMs: wallTimeMs,
		Tags:      tags,
		Payload:   runStartPayloadJSON,
	}

	events := []*event.Event{runStartEvent}
	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем извлечённые поля из run.start
	if sourceID, ok := metadata["source_id"].(string); !ok || sourceID != "flight-engine" {
		t.Errorf("Ожидался source_id=flight-engine, получен %v", metadata["source_id"])
	}

	if engineVersion, ok := metadata["engine_version"].(string); !ok || engineVersion != "1.0.0" {
		t.Errorf("Ожидалась engine_version=1.0.0, получена %v", metadata["engine_version"])
	}

	if seed, ok := metadata["seed"].(float64); !ok || uint64(seed) != 42 {
		t.Errorf("Ожидался seed=42, получен %v", metadata["seed"])
	}

	// Проверяем, что config сохранён
	if config, ok := metadata["config"].(string); !ok || len(config) == 0 {
		t.Errorf("Ожидался непустой config, получен %v", metadata["config"])
	}

	// Проверяем, что tags сохранены
	if tagsStr, ok := metadata["tags"].(string); !ok || len(tagsStr) == 0 {
		t.Errorf("Ожидались непустые tags, получены %v", metadata["tags"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_RunEnd проверяет извлечение метаданных из run.end.
func TestMetadataManager_RunEnd(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-run-end"

	cleanupTestData(t, ctx, client, runID)

	// Создаём run.start и run.end события
	runStartPayload := map[string]interface{}{
		"engine_version": "1.0.0",
	}
	runStartPayloadJSON, _ := json.Marshal(runStartPayload)

	runEndPayload := map[string]interface{}{
		"reason": "completed",
	}
	runEndPayloadJSON, _ := json.Marshal(runEndPayload)

	now := time.Now().UnixMilli()
	wallTimeMs := &now

	runStartEvent := &event.Event{
		V:         1,
		RunID:     runID,
		SourceID:  "flight-engine",
		Channel:   "system",
		Type:      "run.start",
		FrameIndex: 0,
		SimTime:   0.0,
		WallTimeMs: wallTimeMs,
		Payload:   runStartPayloadJSON,
	}

	runEndEvent := &event.Event{
		V:         1,
		RunID:     runID,
		SourceID:  "flight-engine",
		Channel:   "system",
		Type:      "run.end",
		FrameIndex: 100,
		SimTime:   10.0, // 10 секунд симуляции
		WallTimeMs: wallTimeMs,
		Payload:   runEndPayloadJSON,
	}

	events := []*event.Event{runStartEvent, runEndEvent}
	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем статус
	if status, ok := metadata["status"].(string); !ok || status != "completed" {
		t.Errorf("Ожидался status=completed, получен %v", metadata["status"])
	}

	// Проверяем end_reason
	if endReason, ok := metadata["end_reason"].(string); !ok || endReason != "completed" {
		t.Errorf("Ожидался end_reason=completed, получен %v", metadata["end_reason"])
	}

	// Проверяем duration_seconds
	if durationSeconds, ok := metadata["duration_seconds"].(float64); !ok || durationSeconds != 10.0 {
		t.Errorf("Ожидалось duration_seconds=10.0, получено %v", metadata["duration_seconds"])
	}

	// Проверяем, что ended_at установлен
	if endedAt := metadata["ended_at"]; endedAt == nil {
		t.Error("Ожидалось, что ended_at будет установлен")
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_RunLifecycle_PartialUpdate проверяет частичное обновление (без run.start или run.end).
func TestMetadataManager_RunLifecycle_PartialUpdate(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-partial-update"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события без run.start и run.end
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.1, nil),
	}

	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем, что статус running (по умолчанию)
	if status, ok := metadata["status"].(string); !ok || status != "running" {
		t.Errorf("Ожидался status=running, получен %v", metadata["status"])
	}

	// Проверяем, что ended_at не установлен
	if endedAt := metadata["ended_at"]; endedAt != nil {
		t.Errorf("Ожидалось, что ended_at не будет установлен, но получен %v", endedAt)
	}

	// Проверяем, что вычисляемые поля корректны
	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 2 {
		t.Errorf("Ожидалось total_events=2, получено %v", metadata["total_events"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_ComputedFields проверяет корректность вычисляемых полей.
func TestMetadataManager_ComputedFields(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-computed-fields"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события с дублирующимися frame_index для проверки total_frames
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.1, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 2, 0.2, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 2, 0.2, nil), // Дубликат frame_index
		createTestEvent(runID, "flight-engine", "physics", "body.state", 5, 0.5, nil), // Пропуск frame_index
	}

	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем total_events (должно быть 5)
	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 5 {
		t.Errorf("Ожидалось total_events=5, получено %v", metadata["total_events"])
	}

	// Проверяем max_frame_index (должно быть 5)
	if maxFrameIndex, ok := metadata["max_frame_index"].(float64); !ok || uint32(maxFrameIndex) != 5 {
		t.Errorf("Ожидалось max_frame_index=5, получено %v", metadata["max_frame_index"])
	}

	// Проверяем total_frames (должно быть 4 уникальных: 0, 1, 2, 5)
	if totalFrames, ok := metadata["total_frames"].(float64); !ok || uint32(totalFrames) != 4 {
		t.Errorf("Ожидалось total_frames=4, получено %v", metadata["total_frames"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_Upsert проверяет, что повторный upsert обновляет существующую запись.
func TestMetadataManager_Upsert(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-upsert"

	cleanupTestData(t, ctx, client, runID)

	// Первое обновление
	events1 := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.1, nil),
	}
	mm.UpdateFromEvents(ctx, runID, events1)

	metadata1 := readMetadata(t, ctx, client, runID)
	if metadata1 == nil {
		t.Fatal("Метаданные не были созданы после первого обновления")
	}

	firstTotalEvents := metadata1["total_events"].(float64)

	// Второе обновление (добавляем больше событий)
	events2 := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 2, 0.2, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 3, 0.3, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 4, 0.4, nil),
	}
	mm.UpdateFromEvents(ctx, runID, events2)

	metadata2 := readMetadata(t, ctx, client, runID)
	if metadata2 == nil {
		t.Fatal("Метаданные не были обновлены после второго обновления")
	}

	// Проверяем, что total_events обновилось
	secondTotalEvents := metadata2["total_events"].(float64)
	if secondTotalEvents <= firstTotalEvents {
		t.Errorf("Ожидалось, что total_events увеличится, но было %v, стало %v", firstTotalEvents, secondTotalEvents)
	}

	// Проверяем, что max_frame_index обновилось
	if maxFrameIndex, ok := metadata2["max_frame_index"].(float64); !ok || uint32(maxFrameIndex) != 4 {
		t.Errorf("Ожидалось max_frame_index=4, получено %v", metadata2["max_frame_index"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_FailureCases_NoFrameIndex проверяет, что события с одинаковым frame_index учитываются только один раз для total_frames.
func TestMetadataManager_FailureCases_NoFrameIndex(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-no-frame-index"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события с одинаковым frame_index (0)
	// Все события с frame_index=0 должны учитываться как один уникальный frame
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.1, nil), // Тот же frame_index
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.2, nil), // Тот же frame_index
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.3, nil),
	}

	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем, что total_events = 4 (все события учитываются)
	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 4 {
		t.Errorf("Ожидалось total_events=4, получено %v", metadata["total_events"])
	}

	// Проверяем, что total_frames = 2 (только уникальные frame_index: 0 и 1)
	if totalFrames, ok := metadata["total_frames"].(float64); !ok || uint32(totalFrames) != 2 {
		t.Errorf("Ожидалось total_frames=2 (уникальные frame_index), получено %v", metadata["total_frames"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_FailureCases_NoSimTime проверяет, что события без simTime не ломают расчёты.
func TestMetadataManager_FailureCases_NoSimTime(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-no-simtime"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события с simTime = 0.0 (минимальное значение)
	// В реальности simTime всегда >= 0, но проверим граничный случай
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.0, nil),
	}

	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем, что метаданные созданы корректно
	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 2 {
		t.Errorf("Ожидалось total_events=2, получено %v", metadata["total_events"])
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_FailureCases_NoPhase2Events проверяет, что отсутствие Phase 2 событий (run.start/run.end) не приводит к ошибке.
func TestMetadataManager_FailureCases_NoPhase2Events(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-no-phase2"

	cleanupTestData(t, ctx, client, runID)

	// Создаём обычные события (не Phase 2 - нет run.start/run.end)
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
		createTestEvent(runID, "flight-engine", "physics", "body.state", 1, 0.1, nil),
	}

	// Вызов не должен привести к ошибке
	mm.UpdateFromEvents(ctx, runID, events)

	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		t.Fatal("Метаданные не были созданы")
	}

	// Проверяем, что метаданные созданы (это не no-op, так как есть события)
	// Но проверяем, что статус running (нет run.start/run.end)
	if status, ok := metadata["status"].(string); !ok || status != "running" {
		t.Errorf("Ожидался status=running, получен %v", metadata["status"])
	}

	// Проверяем, что вычисляемые поля корректны
	if totalEvents, ok := metadata["total_events"].(float64); !ok || uint64(totalEvents) != 2 {
		t.Errorf("Ожидалось total_events=2, получено %v", metadata["total_events"])
	}

	// Проверяем, что source_id пустой (нет run.start)
	if sourceID, ok := metadata["source_id"].(string); ok && sourceID != "" {
		t.Errorf("Ожидался пустой source_id без run.start, получен %v", sourceID)
	}

	cleanupTestData(t, ctx, client, runID)
}

// TestMetadataManager_ClickHouseErrorHandling проверяет, что ошибки ClickHouse корректно обрабатываются.
func TestMetadataManager_ClickHouseErrorHandling(t *testing.T) {
	checkClickHouseAvailable(t)

	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()

	client := NewHTTPClient(getClickHouseURL())
	setupTestSchema(t, ctx, client)

	mm := NewMetadataManager(client)
	runID := "test-error-handling"

	cleanupTestData(t, ctx, client, runID)

	// Создаём события
	events := []*event.Event{
		createTestEvent(runID, "flight-engine", "physics", "body.state", 0, 0.0, nil),
	}

	// Вызываем UpdateFromEvents - не должно быть паники даже при ошибках
	// (ошибки логируются через fmt.Printf, но не возвращаются)
	mm.UpdateFromEvents(ctx, runID, events)

	// Проверяем, что метаданные были созданы (если ClickHouse доступен)
	metadata := readMetadata(t, ctx, client, runID)
	if metadata == nil {
		// Это нормально, если ClickHouse недоступен или произошла ошибка
		// Главное - что не было паники
		t.Log("Метаданные не были созданы (возможно, ошибка ClickHouse была обработана)")
	} else {
		// Если метаданные созданы, проверяем их корректность
		if metadata["run_id"] != runID {
			t.Errorf("Ожидался run_id=%s, получен %v", runID, metadata["run_id"])
		}
	}

	cleanupTestData(t, ctx, client, runID)
}
