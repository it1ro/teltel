# Teltel Live UI

Декларативный UI сервис для визуализации телеметрии в реальном времени.

## Версии Live UI

### 🎯 Live UI v2 — COMPLETED (заморожена)

**Архитектура зафиксирована.** Live UI v2 является стабильной, завершённой исследовательской средой для анализа run'ов.

**Включает:**
- Декларативный Layout и ChartSpec (JSON Schema v1.0)
- Shared State Engine (централизованное управление состоянием)
- Data Layer (WebSocket + Live Buffer + Window Logic + Data Adapter)
- Chart Engine (Observable Plot: time_series, scatter, histogram)
- Event Timeline (D3: визуализация дискретных событий)
- **Interaction Layer** (полная интерактивность):
  - Hover & Tooltip
  - Time Cursor (click / drag)
  - Zoom & Pan
  - Live Control (Play / Pause)
  - Manual Time Scrubbing
  - Синхронизация интерактивности между графиками

Подробнее см. [LIVE_UI_V2_FREEZE.md](../docs/LIVE_UI_V2_FREEZE.md)

### 🎯 Live UI v1 — COMPLETED (зафиксирована)

**Архитектура зафиксирована.** Live UI v1 включает базовую функциональность без интерактивности.

**Включает:**
- Декларативный Layout (JSON Schema v1.0)
- Универсальный ChartSpec (JSON Schema v1.0)
- Shared State Engine
- Data Layer (WebSocket + Live Buffer)
- Chart Engine (Observable Plot)
- Event Timeline (D3)

## Архитектура

Live UI реализован как отдельный сервис на базе:
- **Vite** — сборщик и dev-сервер
- **React** — UI библиотека
- **TypeScript** — типизация
- **AJV** — валидация JSON Schema
- **Observable Plot** — визуализация графиков
- **D3** — кастомные визуализации (Event Timeline)

## Принципы

- **Полностью декларативный UI** — структура описывается через JSON (Layout + ChartSpec)
- **Строгая валидация** — невалидный конфиг блокирует запуск UI
- **Иммутабельность** — Layout и ChartSpec не изменяются во время работы
- **Централизованное состояние** — shared_state для синхронизации компонентов
- **Изоляция слоёв** — Chart Engine, Data Layer, Shared State изолированы друг от друга
- **Data Layer изолирован от UI** — подключение к backend без визуализации
- **Chart Engine — чистый визуальный слой** — не знает про WebSocket и shared_state

## Структура проекта

```
live-ui/
├── src/
│   ├── schemas/              # JSON Schema контракты
│   │   ├── layout.schema.json
│   │   └── chartSpec.schema.json
│   ├── types/                # TypeScript типы
│   │   └── index.ts
│   ├── utils/                # Утилиты
│   │   ├── loader.ts         # Загрузка и валидация layout
│   │   └── validator.ts      # Валидация через AJV
│   ├── components/
│   │   ├── regions/          # Компоненты регионов
│   │   │   ├── HeaderRegion.tsx
│   │   │   ├── LeftPanelRegion.tsx
│   │   │   └── MainPanelRegion.tsx
│   │   ├── charts/           # Chart Engine
│   │   │   ├── ChartRenderer.tsx
│   │   │   ├── TimeSeriesChart.tsx
│   │   │   ├── ScatterChart.tsx
│   │   │   ├── HistogramChart.tsx
│   │   │   └── EventTimelineChart.tsx
│   │   ├── interaction/      # Interaction Layer
│   │   │   ├── TooltipLayer.tsx
│   │   │   ├── LiveControl.tsx
│   │   │   └── TimeScrubber.tsx
│   │   └── layout/            # Layout движок
│   │       └── LayoutRenderer.tsx
│   ├── context/              # Context провайдеры
│   │   ├── SharedStateContext.tsx  # Shared State Engine
│   │   ├── DataLayerContext.tsx    # Data Layer Context
│   │   └── index.ts
│   ├── data/                 # Data Layer
│   │   ├── types.ts          # Event Model типы
│   │   ├── websocket.ts      # WebSocket клиент
│   │   ├── buffer.ts         # Live Buffer
│   │   ├── window.ts         # Window Logic
│   │   ├── adapter.ts        # Data Adapter
│   │   ├── layer.ts          # Главный Data Layer класс
│   │   └── index.ts          # Экспорты
│   ├── hooks/                # React Hooks
│   │   ├── useDataLayer.ts   # Data Layer hook
│   │   ├── useChartData.ts   # Chart data hook
│   │   ├── useHoverInteraction.ts      # Hover interaction
│   │   ├── useTimeCursorInteraction.ts # Time cursor interaction
│   │   ├── useZoomPanInteraction.ts    # Zoom & pan interaction
│   │   ├── useLiveMode.ts              # Live mode control
│   │   ├── useTimeRange.ts             # Time range hook
│   │   ├── useChartSync.ts             # Chart synchronization
│   │   └── index.ts
│   ├── App.tsx               # Главный компонент
│   └── main.tsx              # Точка входа
├── public/
│   └── example-layout.json    # Пример валидного layout
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Этапы реализации

### ✅ Этап 1: Контракты и валидация

- [x] JSON Schema для Layout Contract
- [x] JSON Schema для ChartSpec Contract
- [x] Loader & Validator с использованием AJV
- [x] Строгая валидация с понятными ошибками

### ✅ Этап 2: Layout Engine

- [x] LayoutRenderer компонент
- [x] React-компоненты регионов:
  - HeaderRegion
  - LeftPanelRegion
  - MainPanelRegion
- [x] Grid layout для main_panel
- [x] Заглушки компонентов без данных

### ✅ Этап 3: Shared State Engine

- [x] SharedStateContext и SharedStateProvider
- [x] Типизация согласно layout-контракту
- [x] Поддержка time_cursor (axis, value, sync_across)
- [x] Поддержка selected_run (run_id, source)
- [x] Хуки useSharedState и useSharedStateField
- [x] Система подписок для синхронизации компонентов
- [x] Интеграция в App.tsx

### ✅ Этап 4: Data Layer

- [x] WebSocket Client для подключения к teltel
- [x] Event Ingestion pipeline (валидация, маршрутизация)
- [x] Live Buffer (хранение событий в памяти, индексирование)
- [x] Window Logic (frames/time/all ограничения)
- [x] Data Adapter (преобразование событий в формат для визуализации)
- [x] React Hooks (useDataLayer, useChartData)
- [x] Data Layer изолирован от UI и визуализации

### ✅ Этап 5: Chart Engine

- [x] ChartRenderer компонент (делегирование рендера по типу графика)
- [x] TimeSeriesChart (Observable Plot: line, area, point marks)
- [x] ScatterChart (Observable Plot: phase space визуализация)
- [x] HistogramChart (Observable Plot: автоматические bins)
- [x] Real-time обновления без мерцания
- [x] DataLayerContext для передачи DataLayer через приложение
- [x] Интеграция в MainPanelRegion

### ✅ Этап 6: Event Timeline

- [x] EventTimelineChart (D3: визуализация дискретных событий)
- [x] X-ось синхронизирована с другими графиками (frameIndex/simTime)
- [x] Y-ось категориальная (type/channel) или фиксированная
- [x] Color, Shape, Size mappings
- [x] Real-time обновления без мерцания
- [x] Интеграция в ChartRenderer

### ✅ Этап 7: Interaction Layer

- [x] **7.1**: Расширение SharedState для интерактивности (interaction_state, live_mode, hover_state)
- [x] **7.2**: Hover & Tooltip Layer (обработка hover, отображение tooltip)
- [x] **7.3**: Time Cursor Interaction (click/drag, визуализация курсора, синхронизация)
- [x] **7.4**: Zoom & Pan (wheel events для zoom, drag для pan, синхронизация)
- [x] **7.5**: Live Control (Play/Pause кнопки, автоматическое обновление time_cursor)
- [x] **7.6**: Manual Time Scrubbing (slider для выбора времени)
- [x] **7.7**: Синхронизация интерактивности между графиками

## Установка и запуск

```bash
# Установка зависимостей
npm install

# Запуск dev-сервера
npm run dev

# Сборка для production
npm run build

# Проверка типов
npm run type-check
```

## Использование

### Загрузка Layout

Layout загружается и валидируется при старте приложения:

```typescript
import { loadLayout } from './utils/loader';

const config = {
  layout: {
    version: '1.0',
    layout_id: 'my_layout',
    regions: {
      // ... описание регионов
    }
  }
};

const validated = loadLayout(config);
```

### Валидация

При невалидном конфиге UI не стартует, выводится детальная ошибка:

```
Layout validation failed:
  /regions/main_panel/grid_config/columns: must be >= 1
  /regions/header/components/0/type: must be equal to one of the allowed values

Layout должен соответствовать контракту версии 1.0.
```

### Использование Shared State

Shared State Engine предоставляет централизованное управление состоянием:

```typescript
import { SharedStateProvider } from './context/SharedStateContext';
import { useSharedState, useSharedStateField } from './context/SharedStateContext';

// В App.tsx
<SharedStateProvider initialSharedState={layout.shared_state}>
  <LayoutRenderer layout={layout} />
</SharedStateProvider>

// В компоненте
const MyComponent = () => {
  // Полный доступ к shared_state
  const { sharedState, updateTimeCursor, updateSelectedRun } = useSharedState();
  
  // Или подписка на конкретное поле
  const [timeCursor, updateTimeCursor] = useSharedStateField('time_cursor');
  const [selectedRun, updateSelectedRun] = useSharedStateField('selected_run');
  
  // timeCursor: { axis: 'frameIndex' | 'simTime', value: number | null, sync_across?: string[] }
  // selectedRun: { run_id: string | null, source: string | null }
};
```

### Использование Data Layer

Data Layer предоставляет доступ к данным через WebSocket:

```typescript
import { useDataLayer } from './hooks/useDataLayer';
import { useChartData } from './hooks/useChartData';
import type { ChartSpec } from './types';

// В компоненте
const MyComponent = () => {
  // Создание Data Layer
  const { dataLayer, connectionState, connect } = useDataLayer({
    autoConnect: true,
    initialRequest: {
      runId: 'run-123',
      channel: 'flight',
    },
  });

  // Получение данных для графика
  const chartSpec: ChartSpec = {
    chart_id: 'altitude_chart',
    version: '1.0',
    type: 'time_series',
    data_source: {
      type: 'event_stream',
      run_id: 'run-123',
      filters: {
        channel: 'flight',
        type: 'state',
      },
      window: {
        type: 'frames',
        size: 1000,
      },
    },
    mappings: {
      x: { field: 'frameIndex' },
      y: { field: 'payload.altitude' },
    },
  };

  const { series, isLoading, error } = useChartData(chartSpec, dataLayer);

  // series: Series[] - готовые данные для визуализации
  // Каждая series содержит points: DataPoint[]
};
```

## Контракты

### Layout Contract

Layout описывает структуру экрана:
- `version`: "1.0" (обязательно)
- `layout_id`: уникальный идентификатор
- `regions`: объект с регионами (header, left_panel, main_panel)
- `shared_state`: опциональное состояние для синхронизации

### ChartSpec Contract

ChartSpec описывает конфигурацию графика:
- `chart_id`: уникальный идентификатор
- `version`: "1.0" (обязательно)
- `type`: тип графика (time_series, scatter, и т.д.)
- `data_source`: источник данных
- `mappings`: маппинг полей на оси
- `visual`: визуальные параметры

Подробнее см. [LIVE_UI_ARCHITECTURE_DESIGN.md](../LIVE_UI_ARCHITECTURE_DESIGN.md)

## Ограничения и статус реализации

**Реализовано (Live UI v2):**
- ✅ Контракты и валидация (Layout, ChartSpec)
- ✅ Layout Engine (рендеринг структуры экрана)
- ✅ Shared State Engine (централизованное управление состоянием)
- ✅ Data Layer (WebSocket, Buffer, Window, Adapter)
- ✅ Chart Engine (Observable Plot: time_series, scatter, histogram)
- ✅ Event Timeline (D3: визуализация дискретных событий)
- ✅ Interaction Layer (hover, tooltip, time cursor, zoom, pan, play/pause, scrubbing)
- ✅ Синхронизация интерактивности между графиками

**НЕ реализовано (следующие этапы):**
- ❌ Run Comparison (сравнение нескольких run'ов)
- ❌ Analysis UI (анализ завершённых run'ов)
- ❌ E2E-тесты (автоматизированное тестирование)

**Архитектурные ограничения (зафиксированы):**
- ✅ Layout иммутабелен во время работы
- ✅ ChartSpec иммутабелен во время работы
- ✅ Data Layer изолирован от UI
- ✅ Chart Engine — чистый визуальный слой (не знает про WebSocket и shared_state)
- ✅ Shared State Engine — единственный источник состояния
- ✅ Никаких runtime-изменений структуры

## Разработка

### Добавление нового компонента региона

1. Создайте компонент в `src/components/regions/`
2. Добавьте типы в `src/types/index.ts`
3. Обновите JSON Schema в `src/schemas/layout.schema.json`
4. Используйте в `LayoutRenderer`

### Тестирование валидации

Создайте невалидный layout и убедитесь, что UI не стартует:

```typescript
const invalidLayout = {
  version: '1.0',
  layout_id: 'test',
  regions: {
    main_panel: {
      region: 'main_panel',
      layout: 'grid',
      grid_config: {
        columns: 0  // Ошибка: должно быть >= 1
      },
      charts: []
    }
  }
};

// Должна быть выброшена ошибка
loadLayout({ layout: invalidLayout });
```

## Следующие шаги

После завершения Live UI v2 (Этапы 1-7):

1. **Stage 8**: Run Comparison / Analysis UI
   - Сравнение нескольких run'ов
   - Overlay и side-by-side графики
   - Регрессионный анализ
   - Оффлайн-режим

2. **E2E-тесты и стабилизация**
   - E2E-тесты data-flow
   - Тестирование интерактивных сценариев
   - Регрессионная защита
   - Performance-профилирование

Подробнее см. [ROADMAP_NEXT.md](../docs/ROADMAP_NEXT.md)
