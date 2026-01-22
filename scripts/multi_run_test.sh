#!/bin/bash
# Скрипт для тестирования множественных одновременных run'ов

# Support environment variables for flexible deployment
BASE_URL="${TELTEL_BASE_URL:-http://localhost:8080}"

NUM_RUNS=${1:-10}        # количество одновременных run'ов
RATE_PER_RUN=${2:-1000} # частота событий на run (событий/сек)
DURATION=${3:-60}       # длительность в секундах

echo "Multi-run test: $NUM_RUNS runs, $RATE_PER_RUN events/sec per run, ${DURATION}s"
echo "Base URL: $BASE_URL"

# Запускаем параллельные процессы
pids=()
for i in $(seq 1 $NUM_RUNS); do
    run_id="multi-run-$i-$(date +%s)"
    source_id="source-$i"
    
    (
        frame_index=0
        end_time=$(($(date +%s) + DURATION))
        
        while [ $(date +%s) -lt $end_time ]; do
            sim_time=$(echo "scale=3; $frame_index * 0.016" | bc)
            
            payload=$(cat <<EOF
{
  "v": 1,
  "runId": "$run_id",
  "sourceId": "$source_id",
  "channel": "physics",
  "type": "body.state",
  "frameIndex": $frame_index,
  "simTime": $sim_time,
  "payload": {"body": {"state": {"pos": {"x": $((frame_index % 100)), "y": $i, "z": 0}}}}
}
EOF
)
            
            curl -s -X POST "$BASE_URL/ingest" \
              -H "Content-Type: application/x-ndjson" \
              -d "$payload" > /dev/null
            
            frame_index=$((frame_index + 1))
            
            if [ $((frame_index % RATE_PER_RUN)) -eq 0 ]; then
                sleep 1
            fi
        done
    ) &
    
    pids+=($!)
    echo "Started run $i: $run_id"
done

# Ждём завершения всех процессов
echo "Waiting for all runs to complete..."
for pid in "${pids[@]}"; do
    wait $pid
done

echo "Multi-run test completed"
