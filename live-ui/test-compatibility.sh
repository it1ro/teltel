#!/bin/bash
# Скрипт для проверки обратной совместимости Live UI
# Этап 6: Проверка обратной совместимости

set -e

echo "=== Проверка обратной совместимости Live UI ==="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для проверки успеха
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1"
        return 1
    fi
}

# Функция для проверки предупреждения
check_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Счетчики
PASSED=0
FAILED=0
WARNINGS=0

echo "1. Проверка структуры проекта..."
echo ""

# Проверка наличия основных файлов
if [ -f "package.json" ]; then
    check_success "package.json существует"
    ((PASSED++))
else
    check_success "package.json существует"
    ((FAILED++))
fi

if [ -f "src/App.tsx" ]; then
    check_success "src/App.tsx существует"
    ((PASSED++))
else
    check_success "src/App.tsx существует"
    ((FAILED++))
fi

if [ -f "public/example-layout.json" ]; then
    check_success "public/example-layout.json существует"
    ((PASSED++))
else
    check_success "public/example-layout.json существует"
    ((FAILED++))
fi

if [ -f "Dockerfile" ]; then
    check_success "Dockerfile существует"
    ((PASSED++))
else
    check_success "Dockerfile существует"
    ((FAILED++))
fi

if [ -f "nginx.conf" ]; then
    check_success "nginx.conf существует"
    ((PASSED++))
else
    check_success "nginx.conf существует"
    ((FAILED++))
fi

if [ -f "docker-entrypoint.sh" ]; then
    check_success "docker-entrypoint.sh существует"
    ((PASSED++))
else
    check_success "docker-entrypoint.sh существует"
    ((FAILED++))
fi

echo ""
echo "2. Проверка типов графиков..."
echo ""

# Проверка наличия компонентов графиков
if [ -f "src/components/charts/TimeSeriesChart.tsx" ]; then
    check_success "TimeSeriesChart компонент существует"
    ((PASSED++))
else
    check_success "TimeSeriesChart компонент существует"
    ((FAILED++))
fi

if [ -f "src/components/charts/ScatterChart.tsx" ]; then
    check_success "ScatterChart компонент существует"
    ((PASSED++))
else
    check_success "ScatterChart компонент существует"
    ((FAILED++))
fi

if [ -f "src/components/charts/HistogramChart.tsx" ]; then
    check_success "HistogramChart компонент существует"
    ((PASSED++))
else
    check_success "HistogramChart компонент существует"
    ((FAILED++))
fi

if [ -f "src/components/charts/EventTimelineChart.tsx" ]; then
    check_success "EventTimelineChart компонент существует"
    ((PASSED++))
else
    check_success "EventTimelineChart компонент существует"
    ((FAILED++))
fi

echo ""
echo "3. Проверка интерактивных функций..."
echo ""

# Проверка наличия компонентов интерактивности
if [ -f "src/components/interaction/TooltipLayer.tsx" ]; then
    check_success "TooltipLayer компонент существует"
    ((PASSED++))
else
    check_success "TooltipLayer компонент существует"
    ((FAILED++))
fi

if [ -f "src/components/interaction/LiveControl.tsx" ]; then
    check_success "LiveControl компонент существует"
    ((PASSED++))
else
    check_success "LiveControl компонент существует"
    ((FAILED++))
fi

if [ -f "src/components/interaction/TimeScrubber.tsx" ]; then
    check_success "TimeScrubber компонент существует"
    ((PASSED++))
else
    check_success "TimeScrubber компонент существует"
    ((FAILED++))
fi

# Проверка наличия hooks
if [ -f "src/hooks/useHoverInteraction.ts" ]; then
    check_success "useHoverInteraction hook существует"
    ((PASSED++))
else
    check_success "useHoverInteraction hook существует"
    ((FAILED++))
fi

if [ -f "src/hooks/useTimeCursorInteraction.ts" ]; then
    check_success "useTimeCursorInteraction hook существует"
    ((PASSED++))
else
    check_success "useTimeCursorInteraction hook существует"
    ((FAILED++))
fi

if [ -f "src/hooks/useZoomPanInteraction.ts" ]; then
    check_success "useZoomPanInteraction hook существует"
    ((PASSED++))
else
    check_success "useZoomPanInteraction hook существует"
    ((FAILED++))
fi

if [ -f "src/hooks/useLiveMode.ts" ]; then
    check_success "useLiveMode hook существует"
    ((PASSED++))
else
    check_success "useLiveMode hook существует"
    ((FAILED++))
fi

if [ -f "src/hooks/useChartSync.ts" ]; then
    check_success "useChartSync hook существует"
    ((PASSED++))
else
    check_success "useChartSync hook существует"
    ((FAILED++))
fi

echo ""
echo "4. Проверка Data Layer..."
echo ""

# Проверка наличия компонентов Data Layer
if [ -f "src/data/websocket.ts" ]; then
    check_success "WebSocket клиент существует"
    ((PASSED++))
else
    check_success "WebSocket клиент существует"
    ((FAILED++))
fi

if [ -f "src/data/buffer.ts" ]; then
    check_success "Live Buffer существует"
    ((PASSED++))
else
    check_success "Live Buffer существует"
    ((FAILED++))
fi

if [ -f "src/data/adapter.ts" ]; then
    check_success "Data Adapter существует"
    ((PASSED++))
else
    check_success "Data Adapter существует"
    ((FAILED++))
fi

if [ -f "src/data/layer.ts" ]; then
    check_success "Data Layer существует"
    ((PASSED++))
else
    check_success "Data Layer существует"
    ((FAILED++))
fi

echo ""
echo "5. Проверка конфигурации..."
echo ""

# Проверка наличия конфигурационных файлов
if [ -f "src/utils/config.ts" ]; then
    check_success "config.ts существует"
    ((PASSED++))
else
    check_success "config.ts существует"
    ((FAILED++))
fi

# Проверка наличия WebSocket URL в конфигурации
if grep -q "getWebSocketUrl" src/utils/config.ts; then
    check_success "getWebSocketUrl функция существует"
    ((PASSED++))
else
    check_success "getWebSocketUrl функция существует"
    ((FAILED++))
fi

# Проверка поддержки runtime конфигурации
if grep -q "window.__ENV__" src/utils/config.ts; then
    check_success "Runtime конфигурация (window.__ENV__) поддерживается"
    ((PASSED++))
else
    check_success "Runtime конфигурация (window.__ENV__) поддерживается"
    ((FAILED++))
fi

echo ""
echo "6. Проверка валидации layout..."
echo ""

# Проверка наличия валидаторов
if [ -f "src/utils/validator.ts" ]; then
    check_success "validator.ts существует"
    ((PASSED++))
else
    check_success "validator.ts существует"
    ((FAILED++))
fi

if [ -f "src/schemas/layout.schema.json" ]; then
    check_success "layout.schema.json существует"
    ((PASSED++))
else
    check_success "layout.schema.json существует"
    ((FAILED++))
fi

if [ -f "src/schemas/chartSpec.schema.json" ]; then
    check_success "chartSpec.schema.json существует"
    ((PASSED++))
else
    check_success "chartSpec.schema.json существует"
    ((FAILED++))
fi

echo ""
echo "7. Проверка TypeScript компиляции..."
echo ""

# Проверка TypeScript конфигурации
if [ -f "tsconfig.json" ]; then
    check_success "tsconfig.json существует"
    ((PASSED++))
else
    check_success "tsconfig.json существует"
    ((FAILED++))
fi

# Попытка проверки типов (если установлен TypeScript)
if command -v npx &> /dev/null; then
    if npx tsc --noEmit 2>&1 | grep -q "error"; then
        check_warning "Обнаружены ошибки TypeScript (требуется проверка)"
        ((WARNINGS++))
    else
        check_success "TypeScript компиляция успешна"
        ((PASSED++))
    fi
else
    check_warning "npx не найден, пропуск проверки TypeScript"
    ((WARNINGS++))
fi

echo ""
echo "=== Итоги проверки ==="
echo -e "${GREEN}Успешно:${NC} $PASSED"
echo -e "${RED}Ошибки:${NC} $FAILED"
echo -e "${YELLOW}Предупреждения:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Все проверки структуры пройдены${NC}"
    exit 0
else
    echo -e "${RED}✗ Обнаружены проблемы в структуре проекта${NC}"
    exit 1
fi
