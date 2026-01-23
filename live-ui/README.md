# Teltel Live UI

Декларативный UI сервис для визуализации телеметрии в реальном времени.

## Архитектура

Live UI реализован как отдельный сервис на базе:
- **Vite** — сборщик и dev-сервер
- **React** — UI библиотека
- **TypeScript** — типизация
- **AJV** — валидация JSON Schema

## Принципы

- **Полностью декларативный UI** — структура описывается через JSON
- **Строгая валидация** — невалидный конфиг блокирует запуск UI
- **Иммутабельный layout** — структура не изменяется во время работы
- **Централизованное состояние** — shared_state для синхронизации компонентов
- **Без данных на этапах 1-3** — только контракты, layout-движок и shared_state
- **Data Layer изолирован от UI** — Stage 4 реализует подключение к backend без визуализации

## Структура проекта

```
live-ui/
├── src/
│   ├── schemas/          # JSON Schema контракты
│   │   ├── layout.schema.json
│   │   └── chartSpec.schema.json
│   ├── types/            # TypeScript типы
│   │   └── index.ts
│   ├── utils/            # Утилиты
│   │   ├── loader.ts     # Загрузка и валидация layout
│   │   └── validator.ts  # Валидация через AJV
│   ├── components/
│   │   ├── regions/      # Компоненты регионов
│   │   │   ├── HeaderRegion.tsx
│   │   │   ├── LeftPanelRegion.tsx
│   │   │   └── MainPanelRegion.tsx
│   │   └── layout/       # Layout движок
│   │       └── LayoutRenderer.tsx
│   ├── context/          # Shared State Engine
│   │   ├── SharedStateContext.tsx
│   │   └── index.ts
│   ├── data/             # Data Layer (Stage 4)
│   │   ├── types.ts      # Event Model типы
│   │   ├── websocket.ts  # WebSocket клиент
│   │   ├── buffer.ts     # Live Buffer
│   │   ├── window.ts     # Window Logic
│   │   ├── adapter.ts    # Data Adapter
│   │   ├── layer.ts      # Главный Data Layer класс
│   │   └── index.ts      # Экспорты
│   ├── hooks/            # React Hooks для Data Layer
│   │   ├── useDataLayer.ts
│   │   ├── useChartData.ts
│   │   └── index.ts
│   ├── App.tsx           # Главный компонент
│   └── main.tsx          # Точка входа
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

## Ограничения (Этапы 1-4)

**Реализовано:**
- ✅ Контракты и валидация
- ✅ Layout Engine
- ✅ Рендеринг структуры экрана
- ✅ Shared State Engine (архитектурный механизм)
- ✅ Data Layer (WebSocket, Buffer, Window, Adapter)
- ✅ React Hooks для работы с данными

**НЕ реализовано (следующие этапы):**
- ❌ Observable Plot / D3 графики
- ❌ Пользовательская интерактивность (click, drag, zoom)
- ❌ Подключение компонентов к shared_state (будет в следующих этапах)

**Ограничения Stage 4:**
- ✅ Data Layer изолирован от UI
- ✅ Никаких графиков (Observable Plot / D3)
- ✅ Никакой пользовательской интерактивности
- ✅ Никаких изменений layout или shared_state
- ✅ Data Layer не знает о React (кроме hooks как bridge)

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

После завершения Этапов 1-4:

1. **Этап 5**: Интеграция с Observable Plot / D3 для визуализации
2. **Этап 6**: Подключение компонентов к shared_state
3. **Этап 7**: Интерактивность и контролы
