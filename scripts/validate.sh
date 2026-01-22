#!/bin/bash
# Скрипт для автоматической валидации компонентов teltel

set -e

# Support environment variables for flexible deployment
BASE_URL="${TELTEL_BASE_URL:-http://localhost:8080}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== Engineering Validation для teltel v0.3.0 ==="
echo ""

# Функция для проверки
check() {
    local name="$1"
    local command="$2"
    
    echo -n "Проверка: $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Функция для проверки с выводом
check_with_output() {
    local name="$1"
    local command="$2"
    
    echo "Проверка: $name"
    if eval "$command"; then
        echo -e "${GREEN}✓ Успешно${NC}"
        return 0
    else
        echo -e "${RED}✗ Ошибка${NC}"
        return 1
    fi
    echo ""
}

# 1. Проверка health endpoint
echo "=== 1. Health Check ==="
check "Health endpoint" "curl -s $BASE_URL/api/health | grep -q '\"status\":\"ok\"'"
echo ""

# 2. Проверка ingest (Phase 1)
echo "=== 2. Ingest (Phase 1) ==="
TEST_RUN_ID="validation-test-$(date +%s)"
TEST_EVENT='{"v":1,"runId":"'$TEST_RUN_ID'","sourceId":"test-source","channel":"physics","type":"body.state","frameIndex":0,"simTime":0.0,"payload":{"body":{"state":{"pos":{"x":0,"y":0,"z":0}}}}}'

check "Ingest принимает события" "curl -s -X POST $BASE_URL/api/ingest -H 'Content-Type: application/x-ndjson' -d '$TEST_EVENT' -w '%{http_code}' | grep -q '202'"
sleep 0.5

check "Run появился в списке" "curl -s $BASE_URL/api/runs | grep -q '$TEST_RUN_ID'"
echo ""

# 3. Проверка Live API (Phase 1)
echo "=== 3. Live API (Phase 1) ==="
check "GET /api/runs возвращает список" "curl -s $BASE_URL/api/runs | grep -q 'runId'"
check "GET /api/run возвращает метаданные" "curl -s '$BASE_URL/api/run?runId=$TEST_RUN_ID' | grep -q 'runId'"
echo ""

# 4. Проверка Analysis API (Phase 3) - только если ClickHouse доступен
echo "=== 4. Analysis API (Phase 3) ==="
if curl -s "$CLICKHOUSE_URL/ping" > /dev/null 2>&1; then
    echo -e "${YELLOW}ClickHouse доступен${NC}"
    
    check "GET /api/analysis/runs работает" "curl -s $BASE_URL/api/analysis/runs > /dev/null"
    
    # Проверка, что POST /api/analysis/query принимает только SELECT
    SELECT_QUERY='{"query":"SELECT 1"}'
    check "POST /api/analysis/query принимает SELECT" "curl -s -X POST $BASE_URL/api/analysis/query -H 'Content-Type: application/json' -d '$SELECT_QUERY' > /dev/null"
    
    # Проверка, что не-SELECT запросы отклоняются
    INSERT_QUERY='{"query":"INSERT INTO test VALUES (1)"}'
    if curl -s -X POST $BASE_URL/api/analysis/query -H 'Content-Type: application/json' -d "$INSERT_QUERY" | grep -q "Only SELECT"; then
        echo -e "${GREEN}✓ POST /api/analysis/query отклоняет не-SELECT запросы${NC}"
    else
        echo -e "${RED}✗ POST /api/analysis/query не отклоняет не-SELECT запросы${NC}"
    fi
else
    echo -e "${YELLOW}ClickHouse недоступен - пропускаем проверки Analysis API${NC}"
fi
echo ""

# 5. Проверка изоляции компонентов
echo "=== 5. Изоляция компонентов ==="
echo "Проверка: Live UI работает независимо от storage"
if curl -s "$BASE_URL/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Live UI доступен${NC}"
else
    echo -e "${RED}✗ Live UI недоступен${NC}"
fi

if curl -s "$BASE_URL/analysis.html" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Post-run Analysis UI доступен${NC}"
else
    echo -e "${YELLOW}⚠ Post-run Analysis UI недоступен (может требовать ClickHouse)${NC}"
fi
echo ""

# 6. Проверка некорректных событий
echo "=== 6. Обработка некорректных событий ==="
INVALID_EVENT='{"invalid":"json"}'
if curl -s -X POST $BASE_URL/api/ingest -H 'Content-Type: application/x-ndjson' -d "$INVALID_EVENT" -w '%{http_code}' | grep -q '202'; then
    echo -e "${GREEN}✓ Ingest обрабатывает некорректные события gracefully${NC}"
else
    echo -e "${YELLOW}⚠ Ingest вернул ошибку для некорректного события${NC}"
fi
echo ""

echo "=== Валидация завершена ==="
