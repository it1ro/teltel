package event

import (
	"encoding/json"
	"time"
)

// Event представляет телеметрическое событие.
// Payload хранится как opaque json.RawMessage и не парсится.
type Event struct {
	// Версия схемы события
	V int `json:"v"`

	// Идентификатор запуска симуляции
	RunID string `json:"runId"`

	// Источник события (flight-engine, drive-engine)
	SourceID string `json:"sourceId"`

	// Логическая группа событий (physics, aero, drivetrain, etc.)
	Channel string `json:"channel"`

	// Тип события (run.start, frame.start, body.state, etc.)
	Type string `json:"type"`

	// Индекс кадра симуляции (основная ось анализа)
	FrameIndex int `json:"frameIndex"`

	// Симуляционное время в секундах
	SimTime float64 `json:"simTime"`

	// Время на хосте (epoch ms), опционально
	WallTimeMs *int64 `json:"wallTimeMs,omitempty"`

	// Произвольные теги для фильтрации
	Tags map[string]string `json:"tags,omitempty"`

	// Payload события (opaque, не парсится)
	Payload json.RawMessage `json:"payload"`
}

// Validate проверяет обязательные поля события.
func (e *Event) Validate() error {
	if e.V == 0 {
		return ErrMissingVersion
	}
	if e.RunID == "" {
		return ErrMissingRunID
	}
	if e.SourceID == "" {
		return ErrMissingSourceID
	}
	if e.FrameIndex < 0 {
		return ErrInvalidFrameIndex
	}
	if e.SimTime < 0 {
		return ErrInvalidSimTime
	}
	return nil
}

// SetWallTime устанавливает WallTimeMs текущим временем, если поле не задано.
func (e *Event) SetWallTime() {
	if e.WallTimeMs == nil {
		now := time.Now().UnixMilli()
		e.WallTimeMs = &now
	}
}
