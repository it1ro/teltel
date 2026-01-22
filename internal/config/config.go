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

	// ClickHouseURL - URL для подключения к ClickHouse (опционально, для Phase 2)
	ClickHouseURL string

	// BatcherEnabled - включить Batcher для записи в ClickHouse (Phase 2)
	BatcherEnabled bool

	// BatcherBatchSize - размер батча для записи в ClickHouse
	BatcherBatchSize int

	// BatcherFlushInterval - интервал принудительного flush батча
	BatcherFlushInterval time.Duration
}

// Load загружает конфигурацию из флагов командной строки.
func Load() *Config {
	cfg := &Config{}

	flag.IntVar(&cfg.HTTPPort, "port", 8080, "HTTP server port")
	flag.IntVar(&cfg.BufferCapacity, "buffer-capacity", 10000, "Ring buffer capacity per run")
	flag.IntVar(&cfg.BufferMaxRuns, "buffer-max-runs", 0, "Maximum number of runs (0 = unlimited)")
	flag.DurationVar(&cfg.BufferCleanupInterval, "buffer-cleanup-interval", 5*time.Minute, "Buffer cleanup interval")

	// Phase 2: ClickHouse storage
	flag.StringVar(&cfg.ClickHouseURL, "clickhouse-url", "", "ClickHouse URL (e.g., http://localhost:8123)")
	flag.BoolVar(&cfg.BatcherEnabled, "batcher-enabled", false, "Enable batcher for ClickHouse storage")
	flag.IntVar(&cfg.BatcherBatchSize, "batcher-batch-size", 10000, "Batch size for ClickHouse writes")
	flag.DurationVar(&cfg.BatcherFlushInterval, "batcher-flush-interval", 500*time.Millisecond, "Flush interval for batcher")

	flag.Parse()

	return cfg
}
