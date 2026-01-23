Roadmap Stage 7: Интерактивность Live UI
Цель
Добавить пользовательскую интерактивность поверх Live UI v1, не нарушая архитектурные границы.

Архитектурные принципы
Интерактивность управляется через shared_state
Графики остаются stateless (только рендер)
Plot и D3 — только render-engine
Никакой бизнес-логики в компонентах визуализации
НЕ меняем ChartSpec, Data Layer, структуру shared_state (но можем использовать существующие поля)
Этапы реализации
Этап 7.1: Расширение SharedState для интерактивности
Цель: Добавить поддержку интерактивных состояний в shared_state без изменения базовой структуры.

Задачи:

Расширить SharedState интерфейс опциональными полями:
`interaction_state?: { zoom?: { x?: [number, number], y?: [number, number] }, pan?: { x?: number, y?: number } }`
live_mode?: { is_playing: boolean, playback_speed?: number }
hover_state?: { chart_id: string, x: number, y: number, data?: unknown } | null
Обновить SharedStateContext.tsx:
Добавить методы updateInteractionState, updateLiveMode, updateHoverState
Сохранить обратную совместимость (все новые поля опциональны)
Обновить типы в types/index.ts:
Расширить SharedState интерфейс
Сохранить совместимость с существующим layout-контрактом
Файлы:

src/context/SharedStateContext.tsx
src/types/index.ts
Критерии готовности:

SharedState поддерживает новые опциональные поля
Существующий код продолжает работать
Новые методы доступны через useSharedState hook
---

Этап 7.2: Hover & Tooltip Layer
Цель: Добавить hover-интерактивность и tooltip для всех типов графиков.

Задачи:

Создать TooltipLayer компонент (src/components/interaction/TooltipLayer.tsx):
Позиционирование tooltip относительно курсора
Отображение данных из hover_state
Стилизация tooltip
Создать useHoverInteraction hook (src/hooks/useHoverInteraction.ts):
Обработка mouse events на графиках
Вычисление ближайшей точки данных
Обновление hover_state через shared_state
Интегрировать hover в графики:
TimeSeriesChart: обработка hover на линии/точках
ScatterChart: обработка hover на точках
HistogramChart: обработка hover на столбцах
EventTimelineChart: обработка hover на маркерах событий
Добавить TooltipLayer в ChartRenderer:
Рендеринг tooltip поверх графика
Подписка на hover_state из shared_state
Файлы:

src/components/interaction/TooltipLayer.tsx (новый)
src/hooks/useHoverInteraction.ts (новый)
src/components/charts/TimeSeriesChart.tsx
src/components/charts/ScatterChart.tsx
src/components/charts/HistogramChart.tsx
src/components/charts/EventTimelineChart.tsx
src/components/charts/ChartRenderer.tsx
Критерии готовности:

Hover работает на всех типах графиков
Tooltip показывает релевантные данные (x, y, series, event info)
Tooltip позиционируется корректно
Hover синхронизируется через shared_state
---

Этап 7.3: Time Cursor Interaction
Цель: Добавить интерактивное управление time_cursor через клики и drag на графиках.

Задачи:

Создать useTimeCursorInteraction hook (src/hooks/useTimeCursorInteraction.ts):
Обработка click на графике → установка time_cursor.value
Обработка drag вдоль X-оси → обновление time_cursor.value
Преобразование координат мыши в значения оси (frameIndex/simTime)
Визуализация time_cursor на графиках:
Вертикальная линия на позиции time_cursor.value
Синхронизация между всеми графиками через shared_state
Стилизация курсора (цвет, толщина)
Интегрировать в графики:
Добавить обработчики событий в каждый chart компонент
Рендерить визуальный курсор через Plot/D3
Подписаться на time_cursor из shared_state
Синхронизация между графиками:
При изменении time_cursor в одном графике → обновление во всех
Использовать sync_across из shared_state.time_cursor
Файлы:

src/hooks/useTimeCursorInteraction.ts (новый)
src/components/charts/TimeSeriesChart.tsx
src/components/charts/ScatterChart.tsx
src/components/charts/HistogramChart.tsx
src/components/charts/EventTimelineChart.tsx
Критерии готовности:

Клик на графике устанавливает time_cursor
Drag обновляет time_cursor в реальном времени
Визуальный курсор отображается на всех графиках
Синхронизация работает между графиками
---

Этап 7.4: Zoom & Pan
Цель: Добавить zoom и pan для графиков через shared_state.

Задачи:

Создать useZoomPanInteraction hook (src/hooks/useZoomPanInteraction.ts):
Обработка wheel events → zoom
Обработка drag (без click на данных) → pan
Обновление interaction_state.zoom и interaction_state.pan
Применение zoom/pan к графикам:
Observable Plot: использование x.domain и y.domain из interaction_state
D3 charts: обновление scale.domain из interaction_state
Сохранение zoom/pan состояния в shared_state
Синхронизация zoom/pan:
Опциональная синхронизация между графиками (если указано в layout)
Reset zoom/pan кнопка (опционально в header)
Интеграция в графики:
Подписка на interaction_state из shared_state
Применение domain ограничений к scales
Файлы:

src/hooks/useZoomPanInteraction.ts (новый)
src/components/charts/TimeSeriesChart.tsx
src/components/charts/ScatterChart.tsx
src/components/charts/HistogramChart.tsx
src/components/charts/EventTimelineChart.tsx
Критерии готовности:

Wheel zoom работает на всех графиках
Drag pan работает
Zoom/pan состояние сохраняется в shared_state
Можно сбросить zoom/pan
---

Этап 7.5: Live Control (Play/Pause)
Цель: Добавить управление live-режимом (play/pause) и автоматическое обновление time_cursor.

Задачи:

Создать LiveControl компонент (src/components/interaction/LiveControl.tsx):
Кнопки Play/Pause
Индикатор live-режима
Интеграция в HeaderRegion (если есть global_controls)
Создать useLiveMode hook (src/hooks/useLiveMode.ts):
Управление live_mode.is_playing через shared_state
Автоматическое обновление time_cursor.value при play
Остановка обновлений при pause
Логика автоматического time_cursor:
При play: time_cursor.value обновляется на последний frameIndex/simTime из данных
При pause: time_cursor.value зафиксирован
Использовать данные из Data Layer для определения последнего значения
Интеграция в App.tsx:
LiveControl в HeaderRegion (если есть global_controls в layout)
useLiveMode hook для управления состоянием
Файлы:

src/components/interaction/LiveControl.tsx (новый)
src/hooks/useLiveMode.ts (новый)
src/components/regions/HeaderRegion.tsx
src/App.tsx
Критерии готовности:

Play/Pause кнопки работают
При play time_cursor автоматически обновляется
При pause time_cursor зафиксирован
Состояние сохраняется в shared_state
---

Этап 7.6: Manual Time Scrubbing
Цель: Добавить возможность ручного "скрабирования" времени через time_cursor.

Задачи:

Создать TimeScrubber компонент (src/components/interaction/TimeScrubber.tsx):
Slider для выбора времени
Отображение текущего frameIndex/simTime
Интеграция в HeaderRegion (если есть time_cursor компонент)
Логика скрабирования:
При изменении slider → обновление time_cursor.value
При изменении time_cursor из других источников → обновление slider
Определение диапазона из данных (min/max frameIndex или simTime)
Интеграция с live_mode:
При ручном скрабировании → автоматический pause
При play → slider следует за автоматическим time_cursor
Интеграция в HeaderRegion:
TimeScrubber отображается если есть time_cursor компонент в layout
Подписка на time_cursor и live_mode из shared_state
Файлы:

src/components/interaction/TimeScrubber.tsx (новый)
src/components/regions/HeaderRegion.tsx
src/hooks/useLiveMode.ts (обновление)
Критерии готовности:

TimeScrubber отображается в header
Slider обновляет time_cursor
Скрабирование автоматически ставит на pause
Диапазон определяется из данных (min/max frameIndex или simTime)
---

## Этап 7.7: Синхронизация интерактивности между графиками

**Цель:** Обеспечить синхронизацию интерактивных состояний между графиками через shared_state.

**Задачи:**

1. **Синхронизация hover_state:**
   - При hover на одном графике → обновление hover_state в shared_state
   - Опциональная синхронизация hover между графиками (если указано в layout)
   - Tooltip может показывать данные из нескольких графиков одновременно

2. **Синхронизация time_cursor:**
   - Использовать sync_across из shared_state.time_cursor
   - При изменении time_cursor в одном графике → обновление во всех синхронизированных графиках
   - Визуальный курсор отображается на всех графиках с одинаковым значением

3. **Синхронизация zoom/pan:**
   - Опциональная синхронизация zoom/pan между графиками (если указано в layout)
   - При zoom на одном графике → применение к синхронизированным графикам
   - Сохранение независимости zoom/pan для каждого графика по умолчанию

4. **Логика синхронизации:**
   - Создать useChartSync hook (src/hooks/useChartSync.ts):
     - Определение синхронизированных графиков из layout
     - Подписка на изменения shared_state
     - Применение синхронизированных состояний к графикам
   - Интеграция в ChartRenderer:
     - Передача информации о синхронизации в chart компоненты
     - Обработка синхронизированных событий

**Файлы:**

- `src/hooks/useChartSync.ts` (новый)
- `src/components/charts/ChartRenderer.tsx`
- `src/components/charts/TimeSeriesChart.tsx`
- `src/components/charts/ScatterChart.tsx`
- `src/components/charts/HistogramChart.tsx`
- `src/components/charts/EventTimelineChart.tsx`

**Критерии готовности:**

- Hover синхронизируется между графиками (если указано)
- Time cursor синхронизируется через sync_across
- Zoom/pan может синхронизироваться опционально
- Синхронизация работает без конфликтов

---

## Порядок реализации

Рекомендуемый порядок выполнения этапов:

1. **Этап 7.1** — Расширение SharedState (базовая инфраструктура)
2. **Этап 7.2** — Hover & Tooltip (базовая интерактивность)
3. **Этап 7.3** — Time Cursor Interaction (важная функциональность)
4. **Этап 7.4** — Zoom & Pan (расширенная навигация)
5. **Этап 7.5** — Live Control (управление воспроизведением)
6. **Этап 7.6** — Manual Time Scrubbing (альтернативный способ навигации)
7. **Этап 7.7** — Синхронизация (финальная полировка)

---

## Definition of Done для Stage 7

### Функциональные требования

- ✅ Hover работает на всех типах графиков (time_series, scatter, histogram, event_timeline)
- ✅ Tooltip показывает релевантные данные и позиционируется корректно
- ✅ Time cursor можно установить кликом или drag на графике
- ✅ Визуальный курсор отображается на всех синхронизированных графиках
- ✅ Zoom работает через wheel events на всех графиках
- ✅ Pan работает через drag на всех графиках
- ✅ Play/Pause кнопки управляют live-режимом
- ✅ При play time_cursor автоматически обновляется
- ✅ TimeScrubber позволяет вручную выбирать время
- ✅ Интерактивность синхронизируется между графиками через shared_state

### Архитектурные требования

- ✅ ChartSpec не изменён (только использование существующих полей)
- ✅ Data Layer не изменён
- ✅ Базовая структура shared_state не изменена (только опциональные расширения)
- ✅ Графики остаются stateless (вся логика через shared_state)
- ✅ Plot и D3 используются только как render-engine
- ✅ Никакой бизнес-логики в компонентах визуализации
- ✅ Обратная совместимость с v1 сохранена

### Технические требования

- ✅ Все новые компоненты типизированы через TypeScript
- ✅ Обработка ошибок для edge cases
- ✅ Производительность не деградировала (интерактивность не блокирует рендер)
- ✅ Код следует существующим паттернам проекта

### Тестирование

- ✅ Проверка hover на всех типах графиков
- ✅ Проверка синхронизации time_cursor между графиками
- ✅ Проверка zoom/pan на всех типах графиков
- ✅ Проверка play/pause и автоматического обновления time_cursor
- ✅ Проверка time scrubbing
- ✅ Проверка обратной совместимости с существующими layout'ами

---

## Ограничения и предупреждения

### Что НЕ делаем в Stage 7

- ❌ НЕ изменяем ChartSpec структуру
- ❌ НЕ изменяем Data Layer API
- ❌ НЕ добавляем новые типы графиков
- ❌ НЕ изменяем layout структуру
- ❌ НЕ добавляем бизнес-логику в компоненты визуализации
- ❌ НЕ ломаем существующее поведение v1

### Что делаем

- ✅ Используем существующие поля shared_state (time_cursor, selected_run)
- ✅ Добавляем опциональные расширения shared_state (interaction_state, live_mode, hover_state)
- ✅ Добавляем интерактивность поверх существующих графиков
- ✅ Сохраняем обратную совместимость

---

## Следующие этапы (после Stage 7)

После завершения Stage 7 можно рассматривать:

- Run Overview / Comparison (Stage 8)
- Расширенные фильтры и навигация
- Экспорт данных и скриншотов
- Дополнительные типы графиков (если потребуется)

---

## Ссылки

- [Архитектурный документ](../LIVE_UI_ARCHITECTURE_DESIGN.md)
- [Статус реализации](./IMPLEMENTATION_STATUS.md)
- [README проекта](./README.md)