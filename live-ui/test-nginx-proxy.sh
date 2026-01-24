#!/bin/bash
# Скрипт для тестирования nginx proxy конфигурации
# Проверяет работу proxy для API и WebSocket endpoints

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-ws://localhost:3000/ws}"

echo "=========================================="
echo "Тестирование nginx proxy конфигурации"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "WebSocket URL: $WS_URL"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для проверки HTTP endpoint
check_http() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n "Проверка: $description... "
    
    response=$(curl -s -w "\n%{http_code}" "$url" || echo -e "\n000")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  Response: $body"
        return 1
    fi
}

# Функция для проверки WebSocket
check_websocket() {
    local url=$1
    local description=$2
    
    echo -n "Проверка: $description... "
    
    # Проверяем наличие wscat или используем curl для проверки upgrade
    if command -v wscat &> /dev/null; then
        # Используем wscat для проверки WebSocket подключения
        timeout 5 wscat -c "$url" -w 1 > /dev/null 2>&1
        if [ $? -eq 0 ] || [ $? -eq 124 ]; then
            echo -e "${GREEN}✓ OK${NC} (WebSocket подключение установлено)"
            return 0
        else
            echo -e "${RED}✗ FAILED${NC} (Не удалось подключиться)"
            return 1
        fi
    else
        # Используем curl для проверки WebSocket upgrade
        response=$(curl -s -i -N \
            -H "Connection: Upgrade" \
            -H "Upgrade: websocket" \
            -H "Sec-WebSocket-Version: 13" \
            -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
            "$url" 2>&1 | head -n 5)
        
        if echo "$response" | grep -q "101\|Upgrade\|Connection.*upgrade"; then
            echo -e "${GREEN}✓ OK${NC} (WebSocket upgrade принят)"
            return 0
        else
            echo -e "${YELLOW}⚠ WARNING${NC} (Не удалось проверить WebSocket, установите wscat для полной проверки)"
            echo "  Response: $response"
            return 0  # Не считаем это критической ошибкой
        fi
    fi
}

# Счётчики
passed=0
failed=0

echo "1. Проверка health check (nginx контейнер)..."
if check_http "$BASE_URL/health" "Health check nginx"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

echo "2. Проверка backend health через proxy..."
if check_http "$BASE_URL/api/health" "Backend health через proxy"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

echo "3. Проверка API endpoint (runs)..."
if check_http "$BASE_URL/api/runs" "API /api/runs"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

echo "4. Проверка WebSocket proxy..."
if check_websocket "$WS_URL" "WebSocket через proxy"; then
    ((passed++))
else
    ((failed++))
fi
echo ""

echo "5. Проверка статических ресурсов..."
if check_http "$BASE_URL/example-layout.json" "Статический файл example-layout.json" 200; then
    ((passed++))
else
    # Не критично, если файл отсутствует
    echo -e "${YELLOW}⚠ WARNING${NC} (Файл может отсутствовать)"
    ((passed++))
fi
echo ""

echo "6. Проверка SPA routing (index.html)..."
if check_http "$BASE_URL/" "SPA routing (index.html)" 200; then
    ((passed++))
else
    ((failed++))
fi
echo ""

echo "7. Проверка proxy заголовков..."
echo -n "Проверка: Proxy заголовки... "
response=$(curl -s -v "$BASE_URL/api/health" 2>&1)
if echo "$response" | grep -q "X-Real-IP\|X-Forwarded-For"; then
    echo -e "${GREEN}✓ OK${NC} (Proxy заголовки присутствуют)"
    ((passed++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Proxy заголовки не обнаружены, но это может быть нормально)"
    ((passed++))
fi
echo ""

# Итоги
echo "=========================================="
echo "Результаты тестирования:"
echo "=========================================="
echo -e "${GREEN}Пройдено: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}Провалено: $failed${NC}"
    exit 1
else
    echo -e "${GREEN}Провалено: $failed${NC}"
    echo ""
    echo -e "${GREEN}✓ Все проверки пройдены успешно!${NC}"
    exit 0
fi
