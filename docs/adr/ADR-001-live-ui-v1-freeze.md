# ADR-001: Live UI v1 Architecture Freeze

**Дата:** 2024  
**Статус:** Принято  
**Версия:** Live UI v1.0

---

## Контекст

Реализация Live UI v1 завершена. Все этапы Stage 1–6 выполнены и проверены:

- ✅ Декларативный Layout (JSON Schema v1.0)
- ✅ Универсальный ChartSpec (JSON Schema v1.0)
- ✅ Shared State Engine
- ✅ Data Layer (WebSocket + Live Buffer)
- ✅ Chart Engine (Observable Plot)
- ✅ Event Timeline (D3)

Архитектурный контракт зафиксирован в документе "Проектирование Live UI архитектуры для teltel" (`LIVE_UI_ARCHITECTURE_DESIGN.md`).

## Решение

**Live UI v1 зафиксирована как завершённый milestone. Архитектура версии заморожена.**

### Границы версии

Live UI v1 включает:

1. **Декларативный Layout (JSON Schema v1.0)**
   - Полная валидация структуры layout
   - Поддержка регионов: header, left_panel, main_panel
   - Контракт shared_state

2. **Универсальный ChartSpec (JSON Schema v1.0)**
   - Универсальная модель для всех типов графиков
   - Валидация data_source, mappings, visual
   - Поддержка типов: time_series, scatter, histogram, event_timeline

3. **Shared State Engine**
   - Централизованное управление состоянием UI
   - Поддержка time_cursor (axis, value, sync_across)
   - Поддержка selected_run (run_id, source)
   - Система подписок для синхронизации компонентов

4. **Data Layer (WebSocket + Live Buffer)**
   - WebSocket клиент для подключения к teltel endpoint
   - Event Ingestion и маршрутизация событий
   - Live Buffer с индексированием по runId, channel, type
   - Window Logic (frames/time/all)
   - Data Adapter для преобразования событий в формат визуализации

5. **Chart Engine (Observable Plot)**
   - TimeSeriesChart (line, area, point marks)
   - ScatterChart (phase space визуализация)
   - HistogramChart (автоматические bins)
   - Real-time обновления без мерцания

6. **Event Timeline (D3)**
   - Визуализация дискретных событий на временной оси
   - Синхронизация X-оси с другими графиками
   - Категориальная Y-ось (type/channel)
   - Color, Shape, Size mappings

### Что осознанно не входит в Live UI v1

- ❌ Пользовательская интерактивность (click, drag, zoom, hover, tooltip)
- ❌ Analysis UI (анализ завершённых run'ов)
- ❌ Run Overview / Comparison (сравнение нескольких run'ов)

## Правила изменений после v1

### Что можно делать

- **Bug fixes**: исправление критических ошибок (только через отдельное решение)
- **Live UI v2**: разработка следующей версии с новыми возможностями
- **Engineering Validation**: тестирование Live UI v1 под нагрузкой

### Что нельзя делать

- Изменять архитектурные контракты Live UI v1:
  - JSON Schema для Layout (v1.0)
  - JSON Schema для ChartSpec (v1.0)
  - Структуру shared_state
  - API Data Layer
- Рефакторить код без необходимости
- Добавлять функциональность v2 в v1
- Менять поведение без архитектурного решения

### Процесс изменений

Любые изменения Live UI v1 возможны только через:

1. **Новую версию** (Live UI v2, v3, etc.)
2. **Отдельное архитектурное решение** (ADR)
3. **Критический bug fix** (с обоснованием)

## Последствия

### Положительные

- ✅ Стабильная архитектурная база для дальнейшего развития
- ✅ Чёткие границы версии и ожиданий
- ✅ Возможность параллельной разработки v2 без риска нарушить v1
- ✅ Документированная точка отсчёта для будущих решений

### Отрицательные

- ⚠️ Ограничения на изменения в v1 (требуют отдельного решения)
- ⚠️ Необходимость версионирования для новых возможностей

## Связанные документы

- `LIVE_UI_ARCHITECTURE_DESIGN.md` — архитектурный контракт Live UI
- `live-ui/IMPLEMENTATION_STATUS.md` — статус реализации
- `README.md` — общая документация проекта
