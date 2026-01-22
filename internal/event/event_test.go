package event

import (
	"testing"
	"time"
)

// TestEvent_Validate проверяет валидацию событий.
func TestEvent_Validate(t *testing.T) {
	t.Run("валидное событие проходит валидацию", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			Channel:   "physics",
			Type:      "body.state",
			FrameIndex: 0,
			SimTime:   0.0,
			Payload:   []byte(`{"pos":{"x":0,"y":0,"z":0}}`),
		}

		if err := e.Validate(); err != nil {
			t.Errorf("Validate() вернула ошибку для валидного события: %v", err)
		}
	})

	t.Run("отсутствие поля v → ошибка", func(t *testing.T) {
		e := &Event{
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   0.0,
		}

		err := e.Validate()
		if err == nil {
			t.Error("Validate() должна вернуть ошибку при отсутствии поля 'v'")
		}
		if err != ErrMissingVersion {
			t.Errorf("Validate() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrMissingVersion)
		}
	})

	t.Run("пустое поле runId → ошибка", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   0.0,
		}

		err := e.Validate()
		if err == nil {
			t.Error("Validate() должна вернуть ошибку при пустом поле 'runId'")
		}
		if err != ErrMissingRunID {
			t.Errorf("Validate() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrMissingRunID)
		}
	})

	t.Run("пустое поле sourceId → ошибка", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "",
			FrameIndex: 0,
			SimTime:   0.0,
		}

		err := e.Validate()
		if err == nil {
			t.Error("Validate() должна вернуть ошибку при пустом поле 'sourceId'")
		}
		if err != ErrMissingSourceID {
			t.Errorf("Validate() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrMissingSourceID)
		}
	})

	t.Run("frameIndex < 0 → ошибка", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: -1,
			SimTime:   0.0,
		}

		err := e.Validate()
		if err == nil {
			t.Error("Validate() должна вернуть ошибку при frameIndex < 0")
		}
		if err != ErrInvalidFrameIndex {
			t.Errorf("Validate() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrInvalidFrameIndex)
		}
	})

	t.Run("simTime < 0 → ошибка", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   -1.0,
		}

		err := e.Validate()
		if err == nil {
			t.Error("Validate() должна вернуть ошибку при simTime < 0")
		}
		if err != ErrInvalidSimTime {
			t.Errorf("Validate() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrInvalidSimTime)
		}
	})

	t.Run("frameIndex = 0 проходит валидацию", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   0.0,
		}

		if err := e.Validate(); err != nil {
			t.Errorf("Validate() вернула ошибку для frameIndex=0: %v", err)
		}
	})

	t.Run("simTime = 0 проходит валидацию", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 100,
			SimTime:   0.0,
		}

		if err := e.Validate(); err != nil {
			t.Errorf("Validate() вернула ошибку для simTime=0: %v", err)
		}
	})
}

// TestEvent_SetWallTime проверяет установку wallTime.
func TestEvent_SetWallTime(t *testing.T) {
	t.Run("если wallTime отсутствует → устанавливается автоматически", func(t *testing.T) {
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   0.0,
		}

		if e.WallTimeMs != nil {
			t.Fatal("WallTimeMs должен быть nil до вызова SetWallTime()")
		}

		before := time.Now().UnixMilli()
		e.SetWallTime()
		after := time.Now().UnixMilli()

		if e.WallTimeMs == nil {
			t.Error("WallTimeMs должен быть установлен после вызова SetWallTime()")
		} else {
			wallTime := *e.WallTimeMs
			if wallTime < before || wallTime > after {
				t.Errorf("WallTimeMs должен быть в диапазоне [%d, %d], получено: %d", before, after, wallTime)
			}
		}
	})

	t.Run("если wallTime присутствует → не перезаписывается", func(t *testing.T) {
		originalWallTime := int64(1730000000000)
		e := &Event{
			V:         1,
			RunID:     "run-123",
			SourceID:  "flight-engine",
			FrameIndex: 0,
			SimTime:   0.0,
			WallTimeMs: &originalWallTime,
		}

		e.SetWallTime()

		if e.WallTimeMs == nil {
			t.Error("WallTimeMs не должен стать nil")
		} else if *e.WallTimeMs != originalWallTime {
			t.Errorf("WallTimeMs не должен быть перезаписан. Ожидалось: %d, получено: %d", originalWallTime, *e.WallTimeMs)
		}
	})
}

// TestParseNDJSONLine проверяет парсинг одной строки NDJSON.
func TestParseNDJSONLine(t *testing.T) {
	t.Run("валидная строка → событие", func(t *testing.T) {
		line := `{"v":1,"runId":"run-123","sourceId":"flight-engine","channel":"physics","type":"body.state","frameIndex":100,"simTime":12.5,"payload":{"pos":{"x":1,"y":2,"z":3}}}`
		
		event, err := ParseNDJSONLine(line)
		if err != nil {
			t.Fatalf("ParseNDJSONLine() вернула ошибку для валидной строки: %v", err)
		}

		if event == nil {
			t.Fatal("ParseNDJSONLine() вернула nil событие")
		}

		if event.V != 1 {
			t.Errorf("V = %d, ожидалось 1", event.V)
		}
		if event.RunID != "run-123" {
			t.Errorf("RunID = %q, ожидалось %q", event.RunID, "run-123")
		}
		if event.SourceID != "flight-engine" {
			t.Errorf("SourceID = %q, ожидалось %q", event.SourceID, "flight-engine")
		}
		if event.FrameIndex != 100 {
			t.Errorf("FrameIndex = %d, ожидалось 100", event.FrameIndex)
		}
		if event.SimTime != 12.5 {
			t.Errorf("SimTime = %f, ожидалось 12.5", event.SimTime)
		}
	})

	t.Run("невалидный JSON → ошибка", func(t *testing.T) {
		line := `{"v":1,"runId":"run-123",invalid json}`
		
		event, err := ParseNDJSONLine(line)
		if err == nil {
			t.Error("ParseNDJSONLine() должна вернуть ошибку для невалидного JSON")
		}
		if err != ErrInvalidJSON {
			t.Errorf("ParseNDJSONLine() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrInvalidJSON)
		}
		if event != nil {
			t.Error("ParseNDJSONLine() должна вернуть nil событие при ошибке")
		}
	})

	t.Run("пустая строка → ошибка", func(t *testing.T) {
		event, err := ParseNDJSONLine("")
		if err == nil {
			t.Error("ParseNDJSONLine() должна вернуть ошибку для пустой строки")
		}
		if err != ErrEmptyLine {
			t.Errorf("ParseNDJSONLine() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrEmptyLine)
		}
		if event != nil {
			t.Error("ParseNDJSONLine() должна вернуть nil событие для пустой строки")
		}
	})

	t.Run("строка только с пробелами → ошибка", func(t *testing.T) {
		event, err := ParseNDJSONLine("   \t\n  ")
		if err == nil {
			t.Error("ParseNDJSONLine() должна вернуть ошибку для строки только с пробелами")
		}
		if err != ErrEmptyLine {
			t.Errorf("ParseNDJSONLine() вернула неожиданную ошибку: %v, ожидалась: %v", err, ErrEmptyLine)
		}
		if event != nil {
			t.Error("ParseNDJSONLine() должна вернуть nil событие для строки только с пробелами")
		}
	})

	t.Run("валидный JSON с отсутствующими обязательными полями → ошибка", func(t *testing.T) {
		line := `{"v":1}`
		
		event, err := ParseNDJSONLine(line)
		if err == nil {
			t.Error("ParseNDJSONLine() должна вернуть ошибку при отсутствии обязательных полей")
		}
		if event != nil {
			t.Error("ParseNDJSONLine() должна вернуть nil событие при ошибке валидации")
		}
	})

	t.Run("валидный JSON с некорректными значениями → ошибка", func(t *testing.T) {
		line := `{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":-1,"simTime":0.0}`
		
		event, err := ParseNDJSONLine(line)
		if err == nil {
			t.Error("ParseNDJSONLine() должна вернуть ошибку при некорректных значениях")
		}
		if event != nil {
			t.Error("ParseNDJSONLine() должна вернуть nil событие при ошибке валидации")
		}
	})

	t.Run("валидная строка с wallTimeMs → событие с wallTimeMs", func(t *testing.T) {
		line := `{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":0,"simTime":0.0,"wallTimeMs":1730000000000}`
		
		event, err := ParseNDJSONLine(line)
		if err != nil {
			t.Fatalf("ParseNDJSONLine() вернула ошибку: %v", err)
		}

		if event.WallTimeMs == nil {
			t.Error("WallTimeMs должен быть установлен из JSON")
		} else if *event.WallTimeMs != 1730000000000 {
			t.Errorf("WallTimeMs = %d, ожидалось 1730000000000", *event.WallTimeMs)
		}
	})

	t.Run("валидная строка с tags → событие с tags", func(t *testing.T) {
		line := `{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":0,"simTime":0.0,"tags":{"vehicle":"car01","scene":"freeflight"}}`
		
		event, err := ParseNDJSONLine(line)
		if err != nil {
			t.Fatalf("ParseNDJSONLine() вернула ошибку: %v", err)
		}

		if event.Tags == nil {
			t.Error("Tags должны быть установлены из JSON")
		} else {
			if event.Tags["vehicle"] != "car01" {
				t.Errorf("Tags[\"vehicle\"] = %q, ожидалось %q", event.Tags["vehicle"], "car01")
			}
			if event.Tags["scene"] != "freeflight" {
				t.Errorf("Tags[\"scene\"] = %q, ожидалось %q", event.Tags["scene"], "freeflight")
			}
		}
	})
}

// TestParseNDJSON проверяет парсинг многострочного NDJSON.
func TestParseNDJSON(t *testing.T) {
	t.Run("несколько валидных строк → список событий", func(t *testing.T) {
		data := []byte(`{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":0,"simTime":0.0}
{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":1,"simTime":0.016}
{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":2,"simTime":0.032}`)

		events, errors := ParseNDJSON(data)

		if len(errors) != 0 {
			t.Errorf("ParseNDJSON() вернула ошибки для валидных строк: %v", errors)
		}
		if len(events) != 3 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 3", len(events))
		}

		for i, event := range events {
			if event.FrameIndex != i {
				t.Errorf("Событие %d: FrameIndex = %d, ожидалось %d", i, event.FrameIndex, i)
			}
		}
	})

	t.Run("смешанный поток (валидные + невалидные) → best-effort поведение", func(t *testing.T) {
		data := []byte(`{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":0,"simTime":0.0}
invalid json
{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":2,"simTime":0.032}
{"v":1}
{"v":1,"runId":"run-456","sourceId":"drive-engine","frameIndex":4,"simTime":0.064}`)

		events, errors := ParseNDJSON(data)

		// Ожидаем 3 валидных события и 2 ошибки
		if len(events) != 3 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 3", len(events))
		}
		if len(errors) != 2 {
			t.Errorf("ParseNDJSON() вернула %d ошибок, ожидалось 2", len(errors))
		}

		// Проверяем, что валидные события распарсились корректно
		if events[0].FrameIndex != 0 {
			t.Errorf("Первое событие: FrameIndex = %d, ожидалось 0", events[0].FrameIndex)
		}
		if events[1].FrameIndex != 2 {
			t.Errorf("Второе событие: FrameIndex = %d, ожидалось 2", events[1].FrameIndex)
		}
		if events[2].FrameIndex != 4 {
			t.Errorf("Третье событие: FrameIndex = %d, ожидалось 4", events[2].FrameIndex)
		}
	})

	t.Run("пустые строки → игнорируются", func(t *testing.T) {
		data := []byte(`{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":0,"simTime":0.0}

{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":1,"simTime":0.016}
   
{"v":1,"runId":"run-123","sourceId":"flight-engine","frameIndex":2,"simTime":0.032}`)

		events, errors := ParseNDJSON(data)

		if len(errors) != 0 {
			t.Errorf("ParseNDJSON() вернула ошибки: %v", errors)
		}
		if len(events) != 3 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 3 (пустые строки должны игнорироваться)", len(events))
		}
	})

	t.Run("только пустые строки → пустой результат", func(t *testing.T) {
		data := []byte(`   
  
`)

		events, errors := ParseNDJSON(data)

		if len(errors) != 0 {
			t.Errorf("ParseNDJSON() вернула ошибки для пустых строк: %v", errors)
		}
		if len(events) != 0 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 0", len(events))
		}
	})

	t.Run("пустой вход → пустой результат", func(t *testing.T) {
		data := []byte(``)

		events, errors := ParseNDJSON(data)

		if len(errors) != 0 {
			t.Errorf("ParseNDJSON() вернула ошибки для пустого входа: %v", errors)
		}
		if len(events) != 0 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 0", len(events))
		}
	})

	t.Run("все строки невалидны → только ошибки", func(t *testing.T) {
		data := []byte(`invalid json
{"v":1}
{"v":1,"runId":"","sourceId":"flight-engine","frameIndex":0,"simTime":0.0}`)

		events, errors := ParseNDJSON(data)

		if len(events) != 0 {
			t.Errorf("ParseNDJSON() вернула %d событий, ожидалось 0", len(events))
		}
		if len(errors) != 3 {
			t.Errorf("ParseNDJSON() вернула %d ошибок, ожидалось 3", len(errors))
		}
	})
}
