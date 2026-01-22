#!/bin/bash
# Скрипт для валидации Cursor workflow: воспроизводимость SQL запросов

set -e

# Support environment variables for flexible deployment
BASE_URL="${TELTEL_BASE_URL:-http://localhost:8080}"
CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Валидация Cursor Workflow ==="
echo ""

# Проверка доступности ClickHouse
if ! curl -s "$CLICKHOUSE_URL/ping" > /dev/null 2>&1; then
    echo -e "${RED}✗ ClickHouse недоступен - пропускаем валидацию Cursor workflow${NC}"
    exit 1
fi

echo -e "${GREEN}✓ ClickHouse доступен${NC}"
echo ""

# 1. Проверка детерминированности SQL запросов
echo "=== 1. Детерминированность SQL запросов ==="

# Простой SELECT запрос
QUERY1='{"query":"SELECT run_id, started_at FROM run_metadata ORDER BY started_at DESC LIMIT 5"}'

echo "Выполняем запрос первый раз..."
RESULT1=$(curl -s -X POST $BASE_URL/api/analysis/query \
  -H "Content-Type: application/json" \
  -d "$QUERY1")

sleep 1

echo "Выполняем запрос второй раз..."
RESULT2=$(curl -s -X POST $BASE_URL/api/analysis/query \
  -H "Content-Type: application/json" \
  -d "$QUERY1")

if [ "$RESULT1" = "$RESULT2" ]; then
    echo -e "${GREEN}✓ Запрос возвращает идентичные результаты при повторном выполнении${NC}"
else
    echo -e "${YELLOW}⚠ Запрос возвращает разные результаты (может быть нормально для данных в реальном времени)${NC}"
    echo "Результат 1: $RESULT1"
    echo "Результат 2: $RESULT2"
fi
echo ""

# 2. Проверка SQL helpers
echo "=== 2. SQL Helpers ==="

# Проверяем, что SQL helpers возвращают валидный JSON
if curl -s "$BASE_URL/api/analysis/runs" | python3 -m json.tool > /dev/null 2>&1; then
    echo -e "${GREEN}✓ GET /api/analysis/runs возвращает валидный JSON${NC}"
else
    echo -e "${RED}✗ GET /api/analysis/runs возвращает невалидный JSON${NC}"
fi

# Проверяем формат JSONEachRow (должен быть массив объектов или пустой)
RUNS_RESPONSE=$(curl -s "$BASE_URL/api/analysis/runs")
if [ -z "$RUNS_RESPONSE" ] || echo "$RUNS_RESPONSE" | python3 -c "import sys, json; [json.loads(line) for line in sys.stdin if line.strip()]" 2>/dev/null; then
    echo -e "${GREEN}✓ Формат JSONEachRow корректен${NC}"
else
    echo -e "${YELLOW}⚠ Формат ответа может быть некорректным${NC}"
fi
echo ""

# 3. Проверка, что SQL из UI копируем
echo "=== 3. SQL из UI ==="
echo "Проверка: SQL запросы должны быть видны в UI и копируемы"
echo -e "${YELLOW}⚠ Требуется ручная проверка в браузере: http://localhost:8080/analysis.html${NC}"
echo ""

# 4. Проверка, что только SELECT запросы принимаются
echo "=== 4. Защита от не-SELECT запросов ==="

NON_SELECT_QUERIES=(
    '{"query":"INSERT INTO test VALUES (1)"}'
    '{"query":"DELETE FROM run_metadata WHERE run_id = '\''test'\''"}'
    '{"query":"UPDATE run_metadata SET status = '\''test'\''"}'
    '{"query":"DROP TABLE test"}'
    '{"query":"CREATE TABLE test (id Int32)"}'
)

for query in "${NON_SELECT_QUERIES[@]}"; do
    response=$(curl -s -X POST $BASE_URL/api/analysis/query \
      -H "Content-Type: application/json" \
      -d "$query")
    
    if echo "$response" | grep -q "Only SELECT"; then
        echo -e "${GREEN}✓ Запрос отклонён корректно${NC}"
    else
        echo -e "${RED}✗ Запрос не был отклонён: $query${NC}"
        echo "Ответ: $response"
    fi
done
echo ""

echo "=== Валидация Cursor Workflow завершена ==="
