# Статус реализации Live UI (Этапы 1-5)

## ✅ Выполнено

### Этап 1: Контракты и валидация

- [x] **JSON Schema для Layout Contract** (`src/schemas/layout.schema.json`)
  - Полное описание структуры layout
  - Валидация всех регионов (header, left_panel, main_panel)
  - Валидация shared_state
  - Строгие типы и ограничения

- [x] **JSON Schema для ChartSpec Contract** (`src/schemas/chartSpec.schema.json`)
  - Универсальная модель для всех типов графиков
  - Валидация data_source, mappings, visual
  - Поддержка всех типов графиков из архитектурного документа

- [x] **Loader & Validator** (`src/utils/loader.ts`, `src/utils/validator.ts`)
  - Строгая валидация через AJV
  - Понятные ошибки валидации
  - Блокировка запуска UI при невалидном конфиге
  - Типизация через TypeScript

### Этап 2: Layout Engine

- [x] **LayoutRenderer** (`src/components/layout/LayoutRenderer.tsx`)
  - Читает валидированный layout
  - Рендерит структуру экрана
  - Не зависит от данных

- [x] **React-компоненты регионов**
  - `HeaderRegion` - заглушки компонентов header
  - `LeftPanelRegion` - заглушки секций left panel
  - `MainPanelRegion` - grid layout с заглушками графиков

- [x] **Grid Layout для main_panel**
  - Поддержка columns/rows
  - Поддержка gap
  - Поддержка span для chart placeholders
  - Полностью декларативный (из JSON)

### Этап 3: Shared State Engine

- [x] **SharedStateContext** (`src/context/SharedStateContext.tsx`)
  - Централизованное управление состоянием UI
  - Типизация согласно layout-контракту
  - Поддержка time_cursor (axis, value, sync_across)
  - Поддержка selected_run (run_id, source)

- [x] **SharedStateProvider** (`src/context/SharedStateContext.tsx`)
  - Инициализация из layout.shared_state
  - Обновление состояния через методы updateTimeCursor, updateSelectedRun
  - Система подписок для синхронизации компонентов

- [x] **Хуки для работы с shared_state**
  - `useSharedState()` - доступ к полному контексту
  - `useSharedStateField<K>()` - подписка на конкретное поле
  - Типобезопасность через TypeScript

- [x] **Интеграция в App.tsx**
  - SharedStateProvider оборачивает LayoutRenderer
  - Инициализация из layout.shared_state
  - Готовность к использованию в компонентах регионов

### Этап 4: Data Layer

- [x] **WebSocket Client** (`src/data/websocket.ts`)
  - Подключение к teltel endpoint (`ws://localhost:8080/ws`)
  - Подписка по фильтрам (runId, channel, type, types, tags)
  - Автоматическое переподключение (best-effort)
  - Graceful close
  - Изолирован от React, не хранит UI-состояние

- [x] **Event Ingestion** (`src/data/layer.ts`)
  - Приём событий из WebSocket
  - Валидация базовой структуры события
  - Маршрутизация в Live Buffer
  - Best-effort доставка без потерь

- [x] **Live Buffer** (`src/data/buffer.ts`)
  - Хранение событий в памяти
  - Индексирование по runId, channel, type
  - Поддержка нескольких run'ов
  - Фильтрация по критериям
  - Статистика buffer

- [x] **Window Logic** (`src/data/window.ts`)
  - Применение window ограничений (frames/time/all)
  - Window применяется при чтении данных
  - Удаление старых данных из buffer
  - Window не изменяется во время работы

- [x] **Data Adapter** (`src/data/adapter.ts`)
  - `getSeries(chartSpec)` - чтение данных из buffer
  - Преобразование событий в формат для визуализации
  - Извлечение значений из payload по пути
  - Поддержка multi-series графиков
  - Не содержит логики рендера

- [x] **Data Layer** (`src/data/layer.ts`)
  - Главный класс, объединяющий все компоненты
  - WebSocket + Ingestion + Buffer + Window + Adapter
  - API для подключения и получения данных
  - Изолирован от UI и визуализации

- [x] **React Hooks** (`src/hooks/`)
  - `useDataLayer()` - создание и управление Data Layer
  - `useChartData(chartSpec)` - получение данных графика
  - Тонкий bridge к Data Layer
  - Не управляет состоянием (вся логика в Data Layer)

## 📁 Структура проекта

```
live-ui/
├── src/
│   ├── schemas/              # JSON Schema контракты
│   │   ├── layout.schema.json
│   │   └── chartSpec.schema.json
│   ├── types/                # TypeScript типы
│   │   └── index.ts
│   ├── utils/                # Утилиты
│   │   ├── loader.ts        # Загрузка layout
│   │   └── validator.ts      # Валидация через AJV
│   ├── components/
│   │   ├── regions/          # Компоненты регионов
│   │   │   ├── HeaderRegion.tsx
│   │   │   ├── LeftPanelRegion.tsx
│   │   │   └── MainPanelRegion.tsx
│   │   └── layout/           # Layout движок
│   │       └── LayoutRenderer.tsx
│   ├── context/              # Shared State Engine
│   │   ├── SharedStateContext.tsx
│   │   └── index.ts
│   ├── data/                 # Data Layer (Stage 4)
│   │   ├── types.ts          # Event Model типы
│   │   ├── websocket.ts      # WebSocket клиент
│   │   ├── buffer.ts         # Live Buffer
│   │   ├── window.ts         # Window Logic
│   │   ├── adapter.ts        # Data Adapter
│   │   ├── layer.ts          # Главный Data Layer класс
│   │   └── index.ts          # Экспорты
│   ├── hooks/                # React Hooks для Data Layer
│   │   ├── useDataLayer.ts   # Hook для создания Data Layer
│   │   ├── useChartData.ts   # Hook для получения данных графика
│   │   └── index.ts
│   ├── App.tsx               # Главный компонент
│   └── main.tsx              # Точка входа
├── public/
│   └── example-layout.json   # Пример валидного layout
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🎯 Definition of Done

### Этап 6

- [x] EventTimelineChart реализован с D3 рендерингом
- [x] События визуализируются как маркеры на временной оси
- [x] X-ось синхронизирована с другими графиками (frameIndex/simTime)
- [x] Y-ось категориальная (type/channel) или фиксированная
- [x] Color, Shape, Size mappings поддерживаются
- [x] Real-time обновления без мерцания
- [x] ChartSpec полностью управляет визуализацией
- [x] Интеграция в ChartRenderer
- [x] Обработка ошибок для невалидных ChartSpec
- [x] Архитектурные границы не нарушены
- [x] Никакой интерактивности (Stage 6 ограничение)
- [x] Никаких изменений data-layer
- [x] Никаких изменений shared_state

### Этап 5

- [x] ChartRenderer принимает ChartSpec и делегирует рендер
- [x] TimeSeriesChart, ScatterChart, HistogramChart реализованы
- [x] Observable Plot используется как render-engine
- [x] Данные получаются через useChartData
- [x] Графики обновляются в real-time
- [x] ChartSpec полностью управляет визуализацией
- [x] Обработка ошибок для неподдерживаемых типов
- [x] Архитектурные границы не нарушены
- [x] Никакой интерактивности (Stage 5 ограничение)

### Этапы 1-2

- [x] Layout и ChartSpec валидируются по JSON Schema
- [x] Невалидный конфиг блокирует запуск UI
- [x] Ошибки понятны и локализованы
- [x] Layout полностью рендерится из декларативного JSON
- [x] Все регионы отображаются корректно
- [x] Grid работает согласно конфигурации
- [x] Нет зависимости от данных или backend
- [x] Код готов к подключению shared_state и data-layer

### Этап 3

- [x] SharedStateContext и SharedStateProvider реализованы
- [x] Типизация соответствует layout-контракту
- [x] time_cursor поддерживает axis (frameIndex/simTime) и value
- [x] selected_run поддерживает run_id и source
- [x] Система подписок для синхронизации компонентов
- [x] Интеграция в App.tsx через SharedStateProvider
- [x] Хуки useSharedState и useSharedStateField готовы к использованию
- [x] Никаких данных, WebSocket, backend (строго Stage 3)
- [x] Никакой пользовательской интерактивности (только архитектурный механизм)

### Этап 4

- [x] WebSocket подключается к teltel endpoint
- [x] События принимаются и буферизуются
- [x] Window-логика работает корректно (frames/time/all)
- [x] Данные доступны через `useChartData(chartSpec)`
- [x] Data Layer изолирован от UI
- [x] Код готов к подключению визуализации
- [x] Никаких графиков (Observable Plot / D3)
- [x] Никакой пользовательской интерактивности
- [x] Никаких изменений layout или shared_state

### Этап 5: Chart Engine

- [x] **ChartRenderer** (`src/components/charts/ChartRenderer.tsx`)
  - Принимает ChartSpec и делегирует рендер соответствующему компоненту
  - Определяет тип графика и выбирает компонент
  - Обработка ошибок для неподдерживаемых типов
  - Интеграция с useChartData для получения данных

- [x] **TimeSeriesChart** (`src/components/charts/TimeSeriesChart.tsx`)
  - Визуализация временных рядов через Observable Plot
  - Поддержка line, area, point marks
  - Multi-series поддержка
  - Настройка осей, цветов, стилей из ChartSpec

- [x] **ScatterChart** (`src/components/charts/ScatterChart.tsx`)
  - Визуализация scatter/phase space графиков
  - X и Y из payload
  - Поддержка real-time обновлений

- [x] **HistogramChart** (`src/components/charts/HistogramChart.tsx`)
  - Визуализация гистограмм через Observable Plot
  - Bins рассчитываются автоматически
  - Window применяется на уровне data-layer

- [x] **DataLayerContext** (`src/context/DataLayerContext.tsx`)
  - Контекст для передачи DataLayer через приложение
  - Позволяет ChartRenderer использовать useChartData

- [x] **Интеграция в MainPanelRegion**
  - Замена ChartPlaceholder на ChartRenderer
  - Передача charts из layout
  - Рендеринг графиков по ChartSpec

### Этап 6: Event Timeline

- [x] **EventTimelineChart** (`src/components/charts/EventTimelineChart.tsx`)
  - Визуализация дискретных событий на временной оси через D3
  - X-ось: frameIndex или simTime (синхронизирована с другими графиками)
  - Y-ось: категориальная (по type или channel) или фиксированная линия
  - Color mapping: по channel или type
  - Shape mapping: по type (если указано)
  - Size mapping: опционально (по payload)
  - Real-time обновления без мерцания
  - Window-ограничение данных

- [x] **Интеграция в ChartRenderer**
  - ChartRenderer поддерживает тип `event_timeline`
  - Делегирование рендера EventTimelineChart
  - Обработка ошибок для невалидных ChartSpec

- [x] **D3 зависимость**
  - Добавлена в package.json
  - Используется только для кастомного рендера event_timeline

## 🚫 Что НЕ реализовано (следующие этапы)

- ❌ Пользовательская интерактивность (click, drag, zoom, hover, tooltip)
- ❌ Run Overview / Comparison
- ❌ Подключение компонентов к shared_state для синхронизации (будет в следующих этапах)

## ✅ Архитектурные ограничения соблюдены

- ✅ Layout иммутабелен во время работы
- ✅ ChartSpec иммутабелен во время работы
- ✅ Никаких runtime-изменений структуры
- ✅ Никаких side-effects
- ✅ Никаких "временных решений"
- ✅ Строгое соответствие архитектурному документу
- ✅ Chart Engine не знает про WebSocket
- ✅ Chart Engine не знает про shared_state
- ✅ Chart Engine является чистым визуальным слоем
- ✅ EventTimelineChart использует D3 только для кастомного рендера
- ✅ Никаких изменений data-layer (Stage 6)
- ✅ Никаких изменений shared_state (Stage 6)

## 🧪 Проверка

```bash
# Установка зависимостей
npm install

# Проверка типов
npm run type-check

# Запуск dev-сервера
npm run dev

# Сборка
npm run build
```

## 📝 Пример использования

### Этапы 1-2: Layout Engine

```typescript
import { loadLayout } from './utils/loader';

const config = {
  layout: {
    version: '1.0',
    layout_id: 'my_layout',
    regions: {
      header: { /* ... */ },
      main_panel: { /* ... */ }
    }
  }
};

// Валидация и загрузка
const validated = loadLayout(config);

// Использование в LayoutRenderer
<LayoutRenderer layout={validated.layout} />
```

### Этап 3: Shared State Engine

```typescript
import { SharedStateProvider } from './context/SharedStateContext';
import { useSharedState, useSharedStateField } from './context/SharedStateContext';

// В App.tsx
<SharedStateProvider initialSharedState={layout.shared_state}>
  <LayoutRenderer layout={layout} />
</SharedStateProvider>

// В компоненте (пример для будущего использования)
const MyComponent = () => {
  const { sharedState, updateTimeCursor } = useSharedState();
  // или
  const [timeCursor, updateTimeCursor] = useSharedStateField('time_cursor');
  
  // timeCursor: { axis: 'frameIndex', value: null, sync_across: [...] }
  // updateTimeCursor(newValue) - обновление значения
};
```

### Этап 4: Data Layer

```typescript
import { useDataLayer } from './hooks/useDataLayer';
import { useChartData } from './hooks/useChartData';
import type { ChartSpec } from './types';

// В App.tsx или компоненте
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
  // DataPoint: { x, y, frameIndex, simTime, event }
};
```

### Этап 5: Chart Engine

```typescript
import { ChartRenderer } from './components/charts/ChartRenderer';
import type { ChartSpec } from './types';

// ChartRenderer автоматически используется в MainPanelRegion
// Принимает ChartSpec и рендерит соответствующий график

const chartSpec: ChartSpec = {
  chart_id: 'altitude_chart',
  version: '1.0',
  type: 'time_series',
  data_source: {
    type: 'event_stream',
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
  visual: {
    mark: 'line',
    stroke: '#1f77b4',
    strokeWidth: 2,
  },
  title: 'Altitude',
  axes: {
    x: { label: 'Frame Index', grid: true },
    y: { label: 'Altitude (m)', grid: true },
  },
};

// ChartRenderer автоматически:
// 1. Получает данные через useChartData(chartSpec, dataLayer)
// 2. Определяет тип графика (time_series)
// 3. Делегирует рендер TimeSeriesChart
// 4. TimeSeriesChart рендерит через Observable Plot
```

### Этап 6: Event Timeline

```typescript
import { ChartRenderer } from './components/charts/ChartRenderer';
import type { ChartSpec } from './types';

// Event Timeline для визуализации дискретных событий

const eventTimelineSpec: ChartSpec = {
  chart_id: 'event_timeline_1',
  version: '1.0',
  type: 'event_timeline',
  data_source: {
    type: 'event_stream',
    filters: {
      types: ['run.start', 'run.end', 'frame.start'],
    },
    window: {
      type: 'frames',
      size: 1000,
    },
  },
  mappings: {
    x: { field: 'frameIndex', scale: 'linear' },
    y: { field: 'type' }, // категориальная ось по типу события
    color: {
      field: 'channel',
      scale: 'ordinal',
      palette: ['#1f77b4', '#ff7f0e', '#2ca02c'],
    },
    shape: {
      field: 'type',
      mapping: {
        'run.start': 'circle',
        'run.end': 'square',
        'frame.start': 'triangle',
      },
    },
  },
  visual: {
    stroke: '#333',
    strokeWidth: 1,
    opacity: 0.8,
  },
  title: 'Event Timeline',
  axes: {
    x: { label: 'Frame Index', grid: true },
    y: { label: 'Event Type', grid: true },
  },
};

// ChartRenderer автоматически:
// 1. Получает данные через useChartData(chartSpec, dataLayer)
// 2. Определяет тип графика (event_timeline)
// 3. Делегирует рендер EventTimelineChart
// 4. EventTimelineChart рендерит через D3 SVG
```

## 🔗 Ссылки

- [Архитектурный документ](../LIVE_UI_ARCHITECTURE_DESIGN.md)
- [README проекта](./README.md)
