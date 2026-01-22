#!/bin/bash
# Скрипт для нагрузочного тестирования ingest endpoint

# Support environment variables for flexible deployment
BASE_URL="${TELTEL_BASE_URL:-http://localhost:8080}"

# Параметры
RATE=${1:-1000}        # событий в секунду (по умолчанию 1000)
DURATION=${2:-60}      # длительность в секундах (по умолчанию 60)
RUN_ID=${3:-"load-test-$(date +%s)"}
SOURCE_ID=${4:-"load-test-source"}

echo "Load test: $RATE events/sec for $DURATION seconds"
echo "Base URL: $BASE_URL"
echo "Run ID: $RUN_ID"
echo "Source ID: $SOURCE_ID"

# Генерируем события
for i in $(seq 1 $((RATE * DURATION))); do
    frame_index=$((i - 1))
    sim_time=$(echo "scale=3; $frame_index * 0.016" | bc)
    
    payload=$(cat <<EOF
{
  "v": 1,
  "runId": "$RUN_ID",
  "sourceId": "$SOURCE_ID",
  "channel": "physics",
  "type": "body.state",
  "frameIndex": $frame_index,
  "simTime": $sim_time,
  "payload": {
    "body": {
      "state": {
        "pos": {"x": $((i % 100)), "y": $((i % 200)), "z": $((i % 50))},
        "vel": {"x": 0.1, "y": 0.2, "z": 0.3}
      }
    }
  }
}
EOF
)
    
    curl -s -X POST "$BASE_URL/ingest" \
      -H "Content-Type: application/x-ndjson" \
      -d "$payload" > /dev/null
    
    # Контроль частоты
    if [ $((i % RATE)) -eq 0 ]; then
        sleep 1
    fi
done

echo "Load test completed"
