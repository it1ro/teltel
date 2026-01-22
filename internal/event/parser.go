package event

import (
	"encoding/json"
	"strings"
)

// ParseNDJSONLine парсит одну строку NDJSON в Event.
// Payload остаётся как json.RawMessage и не парсится.
// Возвращает ошибку, если JSON невалиден или отсутствуют обязательные поля.
func ParseNDJSONLine(line string) (*Event, error) {
	line = strings.TrimSpace(line)
	if line == "" {
		return nil, ErrEmptyLine
	}

	var e Event
	if err := json.Unmarshal([]byte(line), &e); err != nil {
		return nil, ErrInvalidJSON
	}

	// Валидация обязательных полей
	if err := e.Validate(); err != nil {
		return nil, err
	}

	return &e, nil
}

// ParseNDJSON парсит многострочный NDJSON.
// Каждая строка обрабатывается независимо.
// Возвращает слайс успешно распарсенных событий и слайс ошибок.
func ParseNDJSON(data []byte) ([]*Event, []error) {
	lines := strings.Split(string(data), "\n")
	var events []*Event
	var errors []error

	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}

		event, err := ParseNDJSONLine(line)
		if err != nil {
			errors = append(errors, err)
			continue
		}

		events = append(events, event)
		_ = i // для будущего логирования номера строки
	}

	return events, errors
}
