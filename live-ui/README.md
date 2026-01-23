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
- **Без данных на этапах 1-2** — только контракты и layout-движок

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

## Ограничения (Этапы 1-2)

**Реализовано:**
- ✅ Контракты и валидация
- ✅ Layout Engine
- ✅ Рендеринг структуры экрана

**НЕ реализовано (следующие этапы):**
- ❌ WebSocket подключение
- ❌ Data layer
- ❌ Observable Plot / D3 графики
- ❌ Shared state логика
- ❌ Интерактивность

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

После завершения Этапов 1-2:

1. **Этап 3**: WebSocket подключение и data layer
2. **Этап 4**: Интеграция с Observable Plot
3. **Этап 5**: Shared state и синхронизация
4. **Этап 6**: Интерактивность и контролы
