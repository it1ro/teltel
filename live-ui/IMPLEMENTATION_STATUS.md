# Статус реализации Live UI (Этапы 1-4)

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

## 🚫 Что НЕ реализовано (следующие этапы)

- ❌ Observable Plot / D3 графики
- ❌ Пользовательская интерактивность (click, drag, zoom)
- ❌ Реальные данные
- ❌ Подключение компонентов к shared_state (будет в следующих этапах)

## ✅ Архитектурные ограничения соблюдены

- ✅ Layout иммутабелен во время работы
- ✅ Никаких runtime-изменений структуры
- ✅ Никаких side-effects
- ✅ Никаких "временных решений"
- ✅ Строгое соответствие архитектурному документу

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

## 🔗 Ссылки

- [Архитектурный документ](../LIVE_UI_ARCHITECTURE_DESIGN.md)
- [README проекта](./README.md)
