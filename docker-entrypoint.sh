#!/bin/sh
set -e

# Convert environment variables to command line flags
ARGS=""

if [ -n "$TELTEL_HTTP_PORT" ]; then
    ARGS="$ARGS -port=$TELTEL_HTTP_PORT"
fi

if [ -n "$TELTEL_BUFFER_CAPACITY" ]; then
    ARGS="$ARGS -buffer-capacity=$TELTEL_BUFFER_CAPACITY"
fi

if [ -n "$TELTEL_BUFFER_MAX_RUNS" ]; then
    ARGS="$ARGS -buffer-max-runs=$TELTEL_BUFFER_MAX_RUNS"
fi

if [ -n "$TELTEL_BUFFER_CLEANUP_INTERVAL" ]; then
    ARGS="$ARGS -buffer-cleanup-interval=$TELTEL_BUFFER_CLEANUP_INTERVAL"
fi

if [ -n "$TELTEL_CLICKHOUSE_URL" ]; then
    ARGS="$ARGS -clickhouse-url=$TELTEL_CLICKHOUSE_URL"
fi

if [ -n "$TELTEL_BATCHER_ENABLED" ]; then
    ARGS="$ARGS -batcher-enabled=$TELTEL_BATCHER_ENABLED"
fi

if [ -n "$TELTEL_BATCHER_BATCH_SIZE" ]; then
    ARGS="$ARGS -batcher-batch-size=$TELTEL_BATCHER_BATCH_SIZE"
fi

if [ -n "$TELTEL_BATCHER_FLUSH_INTERVAL" ]; then
    ARGS="$ARGS -batcher-flush-interval=$TELTEL_BATCHER_FLUSH_INTERVAL"
fi

# Execute teltel with arguments
exec ./teltel $ARGS "$@"
