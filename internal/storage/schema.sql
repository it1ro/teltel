-- ClickHouse schema for teltel Phase 2
-- 
-- This schema implements the storage layer for telemetry events
-- as designed in docs/11-phase2-design.md

-- Main table for telemetry events
CREATE TABLE IF NOT EXISTS telemetry_events (
  -- Identifiers
  run_id String,
  source_id LowCardinality(String),
  channel LowCardinality(String),
  type LowCardinality(String),
  
  -- Timestamps
  frame_index UInt32,
  sim_time Float64,
  wall_time_ms Nullable(UInt64),
  
  -- Metadata
  tags String,  -- JSON string for filtering
  payload String,  -- JSON string with event data
  
  -- Service fields
  inserted_at DateTime DEFAULT now()
)
ENGINE = MergeTree
ORDER BY (run_id, frame_index, source_id)
PARTITION BY toYYYYMM(inserted_at)
SETTINGS index_granularity = 8192;

-- Table for run metadata
CREATE TABLE IF NOT EXISTS run_metadata (
  run_id String,
  
  -- Timestamps
  started_at DateTime,
  ended_at Nullable(DateTime),
  duration_seconds Nullable(Float64),
  
  -- Statistics
  total_events UInt64,
  total_frames UInt32,
  max_frame_index UInt32,
  
  -- Metadata from run.start
  source_id LowCardinality(String),
  config String,  -- JSON string with configuration
  engine_version String,
  seed Nullable(UInt64),
  
  -- Status
  status LowCardinality(String),  -- 'running', 'completed', 'failed', 'cancelled'
  end_reason Nullable(String),  -- from run.end payload
  
  -- Tags from first run.start event
  tags String,  -- JSON string
  
  inserted_at DateTime DEFAULT now(),
  updated_at DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(updated_at)
ORDER BY run_id
SETTINGS index_granularity = 8192;
