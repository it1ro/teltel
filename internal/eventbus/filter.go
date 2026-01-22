package eventbus

import "github.com/teltel/teltel/internal/event"

// Matches проверяет, соответствует ли событие фильтру.
func (f Filter) Matches(e *event.Event) bool {
	// RunID
	if f.RunID != "" && e.RunID != f.RunID {
		return false
	}

	// SourceID
	if f.SourceID != "" && e.SourceID != f.SourceID {
		return false
	}

	// Channel
	if f.Channel != "" && e.Channel != f.Channel {
		return false
	}

	// Types (точное совпадение)
	if len(f.Types) > 0 {
		matched := false
		for _, t := range f.Types {
			if e.Type == t {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// TypePrefix
	if f.TypePrefix != "" {
		if len(e.Type) < len(f.TypePrefix) || e.Type[:len(f.TypePrefix)] != f.TypePrefix {
			return false
		}
	}

	// TagsAll (событие должно содержать все указанные теги)
	if len(f.TagsAll) > 0 {
		if e.Tags == nil {
			return false
		}
		for k, v := range f.TagsAll {
			if e.Tags[k] != v {
				return false
			}
		}
	}

	return true
}
