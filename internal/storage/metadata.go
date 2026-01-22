package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/teltel/teltel/internal/event"
)

// MetadataManager управляет метаданными run'ов в ClickHouse.
type MetadataManager struct {
	client Client
}

// NewMetadataManager создаёт новый MetadataManager.
func NewMetadataManager(client Client) *MetadataManager {
	return &MetadataManager{
		client: client,
	}
}

// UpdateFromEvents обновляет метаданные run'а на основе событий.
func (mm *MetadataManager) UpdateFromEvents(ctx context.Context, runID string, events []*event.Event) {
	if len(events) == 0 {
		return
	}

	// Находим run.start и run.end события
	var runStart *event.Event
	var runEnd *event.Event
	var firstEvent *event.Event // Первое событие для started_at
	var maxFrameIndex uint32
	var totalEvents uint64
	frameIndexSet := make(map[uint32]bool) // Для подсчёта уникальных frame_index

	for _, e := range events {
		if firstEvent == nil || e.FrameIndex < firstEvent.FrameIndex {
			firstEvent = e
		}
		if e.Type == "run.start" {
			runStart = e
		}
		if e.Type == "run.end" {
			runEnd = e
		}
		if uint32(e.FrameIndex) > maxFrameIndex {
			maxFrameIndex = uint32(e.FrameIndex)
		}
		frameIndexSet[uint32(e.FrameIndex)] = true
		totalEvents++
	}

	// Подсчитываем количество уникальных frame_index
	totalFrames := uint32(len(frameIndexSet))

	// Извлекаем метаданные из run.start
	var sourceID string
	var config string
	var engineVersion string
	var seed *uint64
	var tags string

	if runStart != nil {
		sourceID = runStart.SourceID
		config = string(runStart.Payload)
		if runStart.Tags != nil {
			tagsJSON, _ := json.Marshal(runStart.Tags)
			tags = string(tagsJSON)
		}

		// Парсим payload для engine_version и seed
		var payload map[string]interface{}
		if err := json.Unmarshal(runStart.Payload, &payload); err == nil {
			if v, ok := payload["engine_version"].(string); ok {
				engineVersion = v
			}
			if s, ok := payload["seed"].(float64); ok {
				seedVal := uint64(s)
				seed = &seedVal
			}
		}
	}

	// Определяем статус
	status := "running"
	var endedAt *time.Time
	var durationSeconds *float64
	var endReason *string

	if runEnd != nil {
		status = "completed"
		now := time.Now()
		endedAt = &now

		// Парсим payload для end_reason
		var payload map[string]interface{}
		if err := json.Unmarshal(runEnd.Payload, &payload); err == nil {
			if r, ok := payload["reason"].(string); ok {
				endReason = &r
			}
		}
	}

	// Вычисляем duration_seconds если есть оба времени
	if runStart != nil && runEnd != nil {
		duration := runEnd.SimTime - runStart.SimTime
		if duration > 0 {
			durationSeconds = &duration
		}
	}

	// Определяем started_at из первого события или run.start
	var startedAt time.Time
	if runStart != nil && runStart.WallTimeMs != nil {
		startedAt = time.Unix(0, *runStart.WallTimeMs*int64(time.Millisecond))
	} else if firstEvent != nil && firstEvent.WallTimeMs != nil {
		startedAt = time.Unix(0, *firstEvent.WallTimeMs*int64(time.Millisecond))
	} else {
		startedAt = time.Now()
	}

	// Вставляем или обновляем метаданные
	mm.upsertMetadata(ctx, runID, sourceID, config, engineVersion, seed, tags, status, startedAt, endedAt, durationSeconds, endReason, totalEvents, maxFrameIndex, totalFrames)
}

// upsertMetadata вставляет или обновляет метаданные run'а.
func (mm *MetadataManager) upsertMetadata(ctx context.Context, runID, sourceID, config, engineVersion string, seed *uint64, tags, status string, startedAt time.Time, endedAt *time.Time, durationSeconds *float64, endReason *string, totalEvents uint64, maxFrameIndex uint32, totalFrames uint32) {
	// Для ReplacingMergeTree просто вставляем новую запись
	// ClickHouse автоматически заменит старую при merge

	row := map[string]interface{}{
		"run_id":        runID,
		"source_id":     sourceID,
		"config":        config,
		"engine_version": engineVersion,
		"tags":          tags,
		"status":        status,
		"total_events":  totalEvents,
		"total_frames":  totalFrames,
		"max_frame_index": maxFrameIndex,
		"updated_at":    time.Now(),
	}

	if seed != nil {
		row["seed"] = *seed
	}

	if endedAt != nil {
		row["ended_at"] = endedAt.Unix()
	}

	if durationSeconds != nil {
		row["duration_seconds"] = *durationSeconds
	}

	if endReason != nil {
		row["end_reason"] = *endReason
	}

	row["started_at"] = startedAt

	// Сериализуем в JSONEachRow
	jsonData, err := json.Marshal(row)
	if err != nil {
		fmt.Printf("Failed to marshal metadata: %v\n", err)
		return
	}

	// Вставляем в ClickHouse
	if err := mm.client.InsertBatch(ctx, "run_metadata", jsonData); err != nil {
		fmt.Printf("Failed to insert metadata: %v\n", err)
	}
}
