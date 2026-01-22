#!/bin/bash
# Скрипт для тестирования burst-нагрузок

# Support environment variables for flexible deployment
BASE_URL="${TELTEL_BASE_URL:-http://localhost:8080}"

# Параметры
NORMAL_RATE=${1:-1000}    # нормальная частота (событий/сек)
BURST_RATE=${2:-50000}    # burst частота (событий/сек)
BURST_DURATION=${3:-10}   # длительность burst (секунды)
BURST_INTERVAL=${4:-60}   # интервал между burst (секунды)
RUN_ID=${5:-"burst-test-$(date +%s)"}

echo "Burst test: normal=$NORMAL_RATE/sec, burst=$BURST_RATE/sec for ${BURST_DURATION}s every ${BURST_INTERVAL}s"
echo "Base URL: $BASE_URL"
echo "Run ID: $RUN_ID"

frame_index=0

while true; do
    # Нормальная нагрузка
    echo "Normal load: $NORMAL_RATE events/sec"
    for i in $(seq 1 $((NORMAL_RATE * (BURST_INTERVAL - BURST_DURATION)))); do
        sim_time=$(echo "scale=3; $frame_index * 0.016" | bc)
        
        payload=$(cat <<EOF
{
  "v": 1,
  "runId": "$RUN_ID",
  "sourceId": "burst-test-source",
  "channel": "physics",
  "type": "body.state",
  "frameIndex": $frame_index,
  "simTime": $sim_time,
  "payload": {"body": {"state": {"pos": {"x": $((frame_index % 100)), "y": 0, "z": 0}}}}
}
EOF
)
        
        curl -s -X POST "$BASE_URL/api/ingest" \
          -H "Content-Type: application/x-ndjson" \
          -d "$payload" > /dev/null
        
        frame_index=$((frame_index + 1))
        
        if [ $((i % NORMAL_RATE)) -eq 0 ]; then
            sleep 1
        fi
    done
    
    # Burst нагрузка
    echo "BURST: $BURST_RATE events/sec for ${BURST_DURATION}s"
    start_time=$(date +%s)
    burst_count=0
    
    while [ $(($(date +%s) - start_time)) -lt $BURST_DURATION ]; do
        sim_time=$(echo "scale=3; $frame_index * 0.016" | bc)
        
        payload=$(cat <<EOF
{
  "v": 1,
  "runId": "$RUN_ID",
  "sourceId": "burst-test-source",
  "channel": "physics",
  "type": "body.state",
  "frameIndex": $frame_index,
  "simTime": $sim_time,
  "payload": {"body": {"state": {"pos": {"x": $((frame_index % 100)), "y": 0, "z": 0}}}}
}
EOF
)
        
        curl -s -X POST "$BASE_URL/api/ingest" \
          -H "Content-Type: application/x-ndjson" \
          -d "$payload" > /dev/null
        
        frame_index=$((frame_index + 1))
        burst_count=$((burst_count + 1))
        
        # Минимальная задержка для достижения burst rate
        sleep 0.00002  # ~50k events/sec
    done
    
    echo "Burst completed: $burst_count events"
done
