package config

import (
	"flag"
	"time"
)

// Config содержит конфигурацию приложения.
type Config struct {
	// HTTPPort - порт для HTTP сервера (ingest + API)
	HTTPPort int

	// BufferCapacity - размер ring buffer для каждого run'а
	BufferCapacity int

	// BufferMaxRuns - максимальное количество run'ов (0 = без ограничений)
	BufferMaxRuns int

	// BufferCleanupInterval - интервал очистки завершённых run'ов
	BufferCleanupInterval time.Duration
}

// Load загружает конфигурацию из флагов командной строки.
func Load() *Config {
	cfg := &Config{}

	flag.IntVar(&cfg.HTTPPort, "port", 8080, "HTTP server port")
	flag.IntVar(&cfg.BufferCapacity, "buffer-capacity", 10000, "Ring buffer capacity per run")
	flag.IntVar(&cfg.BufferMaxRuns, "buffer-max-runs", 0, "Maximum number of runs (0 = unlimited)")
	flag.DurationVar(&cfg.BufferCleanupInterval, "buffer-cleanup-interval", 5*time.Minute, "Buffer cleanup interval")

	flag.Parse()

	return cfg
}
