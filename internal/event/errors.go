package event

import "errors"

var (
	ErrMissingVersion    = errors.New("event: missing required field 'v'")
	ErrMissingRunID      = errors.New("event: missing required field 'runId'")
	ErrMissingSourceID   = errors.New("event: missing required field 'sourceId'")
	ErrInvalidFrameIndex = errors.New("event: invalid frameIndex (must be >= 0)")
	ErrInvalidSimTime    = errors.New("event: invalid simTime (must be >= 0)")
	ErrInvalidJSON       = errors.New("event: invalid JSON format")
	ErrEmptyLine         = errors.New("event: empty line")
)
