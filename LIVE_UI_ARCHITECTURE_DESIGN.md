Проектирование Live UI архитектуры для teltel
Цель
Создать архитектурный контракт Live UI, который:

определяет декларативную структуру layout
описывает универсальную data-model для графиков
устанавливает связь между layout и charts
фиксирует принципы визуального языка
пригоден для автоматической генерации UI ИИ-агентом
Контекст
Backend архитектура стабилизирована (Event Model, EventBus, Ingest, MetadataManager)
UI выносится в отдельный сервис (Vite + React)
Визуализация: Observable Plot + D3
UI должен быть полностью декларативным
Структура проектирования
1. Live UI Layout Architecture
1.1 Регионы экрана
Live UI состоит из трёх основных регионов:

Header Region

Назначение: контекст и глобальные контролы
Компоненты:
Run selector (выбор активного run'а)
Time cursor (синхронизированная позиция по frameIndex/simTime)
Global controls (play/pause, reset view, export)
Status indicators (connection, data rate, dropped events)
Структура (JSON-like):
{
  "region": "header",
  "height": "60px",
  "components": [
    { "type": "run_selector", "id": "run_selector_1" },
    { "type": "time_cursor", "id": "time_cursor_1", "shared": true },
    { "type": "status_indicator", "id": "status_1" }
  ]
}
Left Panel Region

Назначение: run selection, filters, visibility controls
Компоненты:
Run list (активные и завершённые run'ы)
Filter panel (channel, type, tags)
Chart visibility toggles
Series selector (какие series отображать)
Структура (JSON-like):
{
  "region": "left_panel",
  "width": "300px",
  "collapsible": true,
  "sections": [
    {
      "type": "run_list",
      "id": "run_list_1",
      "filters": { "status": ["running", "completed"] }
    },
    {
      "type": "filter_panel",
      "id": "filter_panel_1",
      "filters": ["channel", "type", "tags"]
    },
    {
      "type": "chart_visibility",
      "id": "chart_visibility_1",
      "source": "layout.main_panel.charts"
    }
  ]
}
Main Panel Region

Назначение: визуализация графиков
Компоненты:
Grid layout для графиков
Каждый график — независимый компонент
Синхронизированные оси времени
Структура (JSON-like):
{
  "region": "main_panel",
  "layout": "grid",
  "grid_config": {
    "columns": 2,
    "rows": "auto",
    "gap": "16px"
  },
  "charts": [
    { "chart_id": "chart_1", "span": [1, 2] },
    { "chart_id": "chart_2", "span": [1, 1] },
    { "chart_id": "chart_3", "span": [1, 1] }
  ]
}
1.2 Layout Contract
Полный layout описывается как JSON-структура:

{
  "version": "1.0",
  "layout_id": "live_ui_default",
  "regions": {
    "header": { /* header region spec */ },
    "left_panel": { /* left panel spec */ },
    "main_panel": { /* main panel spec */ }
  },
  "shared_state": {
    "time_cursor": {
      "axis": "frameIndex",
      "value": null,
      "sync_across": ["main_panel.charts"]
    },
    "selected_run": {
      "run_id": null,
      "source": null
    }
  }
}
1.3 Real-time обновления
Layout не изменяется во время работы (статичен)
Обновляются только данные внутри компонентов
Time cursor синхронизируется через shared_state
Поддержка нескольких run'ов через multi-run layout (опционально)
---

2. Базовый набор графиков (Live UI v1)
2.1 Time Series
Назначение: отображение временных рядов по frameIndex или simTime

Данные:

Источник: event_stream
Фильтры: runId, channel, type
Извлечение: payload.field (например, payload.pos.x)
Визуальные каналы:

X-axis: frameIndex или simTime
Y-axis: числовое значение из payload
Color: по series (если несколько series на одном графике)
Line/Marker: конфигурируемо
Real-time режим:

Новые точки добавляются справа
Автоматический скролл (опционально)
Окно видимости (window) для ограничения точек
2.2 Multi-Axis Time Series
Назначение: несколько series с разными масштабами на одном графике

Данные:

Несколько источников (разные channel/type)
Каждая series имеет свою Y-ось
Визуальные каналы:

X-axis: общая (frameIndex/simTime)
Y-axes: по одной на series
Color: уникальный для каждой series
Real-time режим:

Синхронизация по X-axis
Независимое масштабирование Y-осей
2.3 Event Timeline
Назначение: визуализация дискретных событий на временной оси

Данные:

Источник: event_stream
Фильтры: runId, type (например, run.start, run.end, frame.start)
Каждое событие — точка или маркер
Визуальные каналы:

X-axis: frameIndex/simTime
Y-axis: категориальная (тип события) или числовая (опционально)
Shape: по типу события
Color: по channel или type
Real-time режим:

Новые события появляются справа
Вертикальное размещение по категориям
2.4 Scatter / Phase Space
Назначение: фазовое пространство или корреляция двух величин

Данные:

Источник: event_stream
Два поля из payload (например, payload.aoa vs payload.beta)
Визуальные каналы:

X-axis: первое поле
Y-axis: второе поле
Color: по времени (frameIndex) или категории
Size: опционально (третье измерение)
Real-time режим:

Траектория обновляется по мере поступления данных
Окно видимости для ограничения точек
2.5 Histogram
Назначение: распределение значений за окно времени

Данные:

Источник: aggregated (скользящее окно)
Поле из payload
Окно: последние N кадров или временной интервал
Визуальные каналы:

X-axis: bins (диапазоны значений)
Y-axis: частота
Color: опционально (по категориям)
Real-time режим:

Обновление при каждом новом событии
Скользящее окно пересчитывается
2.6 Run Overview
Назначение: общая информация о run'е

Данные:

Источник: metadata + aggregated
Статистика: total_frames, duration, status
Доступные channels и types
Визуальные каналы:

Текстовые метрики
Опционально: мини-графики (frame rate, event rate)
Real-time режим:

Обновление метаданных при изменении статуса
2.7 Run Comparison (подготовка для Analysis UI)
Назначение: сравнение нескольких run'ов на одном графике

Данные:

Источник: multiple event_streams
Несколько runId
Одинаковые channel/type для всех run'ов
Визуальные каналы:

X-axis: frameIndex/simTime (синхронизировано)
Y-axis: общая для всех series
Color: по runId
Line style: опционально (dashed для завершённых)
Real-time режим:

Обновление только для активных run'ов
Завершённые run'ы статичны
---

3. Декларативная Data-Model для графиков
3.1 ChartSpec Schema
Универсальная модель описания графика:

```json

{

"chart_id": "string",

"version": "1.0",

"type": "time_series | multi_axis_time_series | event_timeline | scatter | histogram | run_overview | run_comparison",

"data_source": {

"type": "event_stream | aggregated | derived",

"run_id": "string | null",

"run_ids": ["string"],  // для run_comparison

"filters": {

"channel": "string | null",

"type": "string | null",

"types": ["string"],

"type_prefix": "string | null",

"tags": { "key": "value" }

},

"window": {

"type": "frames | time | all",

"size": 1000,  // для frames

"duration": 10.0  // для time (секунды)

}

},

"mappings": {

"x": {

"field": "frameIndex | simTime | payload.path",

"scale": "linear | log",

"domain": [null, null]  // auto если null

},

"y": {

"field": "payload.path",

"scale": "linear | log",

"domain": [null, null]

},

"y2": {  // для multi-axis
  "field": "payload.path",
  "scale": "linear | log"
},
"color": {
  "field": "channel | type | payload.path",
  "scale": "ordinal | linear | log",
  "palette": ["string"]  // опционально
},
"size": {  // для scatter
  "field": "payload.path",
  "scale": "linear",
  "range": [2, 10]
},
"shape": {  // для event timeline
  "field": "type",
  "mapping": { "type": "shape" }
}
},
"visual": {
  "mark": "line | area | point | bar",
  "stroke": "string | null",
  "fill": "string | null",
  "opacity": 0.0-1.0,
  "strokeWidth": 1-5,
  "interpolation": "linear | curve | step"
},
"series": [  // для multi-series на одном графике
  {
    "id": "series_1",
    "data_source": { /* data_source spec */ },
    "mappings": { /* mappings spec */ },
    "visual": { /* visual spec */ }
  }
],
"title": "string",
"description": "string | null",
"axes": {
  "x": {
    "label": "string",
    "grid": true,
    "ticks": "auto | number"
  },
  "y": {
    "label": "string",
    "grid": true,
    "ticks": "auto | number"
  }
},
"legend": {
  "show": true,
  "position": "top | bottom | left | right | none"
}
}
```

### 3.2 Связь Layout и Charts

Charts ссылаются в layout через `chart_id`:

```json
{
  "layout": {
    "main_panel": {
      "charts": [
        { "chart_id": "chart_1", "span": [1, 2] }
      ]
    }
  },
  "charts": {
    "chart_1": {
      "chart_id": "chart_1",
      "type": "time_series",
      "data_source": { /* ... */ }
    }
  }
}
```

### 3.3 Real-time обновления данных

- ChartSpec статичен (не изменяется во время работы)
- Обновляются только данные через WebSocket API
- Window скользит автоматически при новых событиях
- Синхронизация через shared_state.time_cursor

---

## 4. Принятые архитектурные решения

### 4.1 Декларативный подход

**Решение:** Live UI полностью декларативен, описывается через JSON-конфигурацию.

**Обоснование:**
- Позволяет автоматическую генерацию UI ИИ-агентом
- Упрощает сохранение и восстановление layout'ов
- Обеспечивает консистентность между различными представлениями

**Контракт:**
- Layout описывается в формате JSON Schema
- ChartSpec описывается в формате JSON Schema
- Изменения layout во время работы не поддерживаются

### 4.2 Трёхрегионная структура

**Решение:** Live UI состоит из трёх регионов: Header, Left Panel, Main Panel.

**Обоснование:**
- Чёткое разделение ответственности
- Предсказуемая структура для пользователей
- Удобство для автоматической генерации

**Контракт:**
- Header: фиксированная высота, глобальные контролы
- Left Panel: опционально сворачиваемый, фильтры и навигация
- Main Panel: адаптивный grid layout для графиков

### 4.3 Синхронизация через shared_state

**Решение:** Синхронизация компонентов (time cursor, selected run) через shared_state в layout.

**Обоснование:**
- Централизованное управление состоянием
- Простота реализации синхронизации графиков
- Прозрачность для ИИ-агента

**Контракт:**
- `shared_state.time_cursor` синхронизирует все графики по оси X
- `shared_state.selected_run` управляет активным run'ом
- Изменения shared_state распространяются на все подписанные компоненты

### 4.4 ChartSpec как универсальная модель

**Решение:** Единая ChartSpec модель для всех типов графиков.

**Обоснование:**
- Упрощает парсинг и валидацию
- Обеспечивает консистентность API
- Позволяет расширять типы графиков без изменения базовой структуры

**Контракт:**
- Все графики описываются через ChartSpec
- Тип графика определяется полем `type`
- Специфичные для типа поля находятся в соответствующих секциях (mappings, visual, series)

### 4.5 Статичность layout при работе

**Решение:** Layout не изменяется во время работы приложения, обновляются только данные.

**Обоснование:**
- Предсказуемость поведения
- Упрощение реализации real-time обновлений
- Избежание race conditions при изменении структуры

**Контракт:**
- Layout загружается при инициализации UI
- Изменение layout требует перезагрузки UI или явного обновления конфигурации
- Данные обновляются через WebSocket API без изменения структуры

### 4.6 Window-based ограничение данных

**Решение:** Графики поддерживают window (frames/time/all) для ограничения отображаемых данных.

**Обоснование:**
- Контроль использования памяти
- Улучшение производительности при больших объёмах данных
- Удобство для real-time визуализации

**Контракт:**
- Window может быть по количеству кадров (`frames`), по времени (`time`) или без ограничений (`all`)
- Window скользит автоматически при новых событиях
- Старые данные за пределами window удаляются из визуализации

### 4.7 Observable Plot + D3 как базовые библиотеки

**Решение:** Использование Observable Plot для основных графиков, D3 для кастомных визуализаций.

**Обоснование:**
- Observable Plot: декларативный подход, хорошая производительность
- D3: гибкость для сложных визуализаций
- Совместимость с декларативной моделью ChartSpec

**Контракт:**
- Стандартные типы графиков (time_series, scatter, histogram) реализуются через Observable Plot
- Кастомные визуализации (event_timeline, run_overview) могут использовать D3
- Все графики должны соответствовать ChartSpec контракту

---

## 5. Контракты и ограничения

### 5.1 Layout Contract

- **Формат:** JSON Schema
- **Версия:** 1.0
- **Иммутабельность:** Layout не изменяется во время работы
- **Валидация:** Обязательна при загрузке

### 5.2 ChartSpec Contract

- **Формат:** JSON Schema
- **Версия:** 1.0
- **Иммутабельность:** ChartSpec не изменяется во время работы
- **Валидация:** Обязательна при создании графика

### 5.3 WebSocket API Contract

- **Источник данных:** Live Buffer
- **Формат событий:** Event Model (как в backend)
- **Подписки:** По runId, channel, type, tags
- **Обновления:** Real-time, best-effort доставка

### 5.4 Ограничения

- Layout не поддерживает динамическое добавление/удаление регионов
- ChartSpec не поддерживает runtime изменение типа графика
- Window не может быть изменён во время работы без перезагрузки графика
- Синхронизация работает только для графиков в main_panel

---

## 6. Примеры использования

### 6.1 Базовый layout с одним графиком

```json
{
  "version": "1.0",
  "layout_id": "simple_time_series",
  "regions": {
    "header": {
      "height": "60px",
      "components": [
        { "type": "run_selector", "id": "run_selector_1" },
        { "type": "time_cursor", "id": "time_cursor_1", "shared": true }
      ]
    },
    "main_panel": {
      "layout": "grid",
      "grid_config": { "columns": 1, "rows": 1 },
      "charts": [
        { "chart_id": "altitude_chart", "span": [1, 1] }
      ]
    }
  },
  "shared_state": {
    "time_cursor": {
      "axis": "frameIndex",
      "value": null,
      "sync_across": ["main_panel.charts"]
    }
  },
  "charts": {
    "altitude_chart": {
      "chart_id": "altitude_chart",
      "type": "time_series",
      "data_source": {
        "type": "event_stream",
        "run_id": null,
        "filters": {
          "channel": "flight",
          "type": "state"
        },
        "window": {
          "type": "frames",
          "size": 1000
        }
      },
      "mappings": {
        "x": {
          "field": "frameIndex",
          "scale": "linear"
        },
        "y": {
          "field": "payload.altitude",
          "scale": "linear"
        }
      },
      "visual": {
        "mark": "line",
        "stroke": "#1f77b4",
        "strokeWidth": 2
      },
      "title": "Altitude",
      "axes": {
        "x": { "label": "Frame Index" },
        "y": { "label": "Altitude (m)" }
      }
    }
  }
}
```

### 6.2 Multi-axis график

```json
{
  "chart_id": "attitude_multi",
  "type": "multi_axis_time_series",
  "data_source": {
    "type": "event_stream",
    "filters": {
      "channel": "flight",
      "type": "state"
    }
  },
  "mappings": {
    "x": { "field": "frameIndex" },
    "y": {
      "field": "payload.aoa",
      "scale": "linear"
    },
    "y2": {
      "field": "payload.beta",
      "scale": "linear"
    }
  },
  "series": [
    {
      "id": "aoa",
      "mappings": { "y": { "field": "payload.aoa" } },
      "visual": { "mark": "line", "stroke": "#1f77b4" }
    },
    {
      "id": "beta",
      "mappings": { "y": { "field": "payload.beta" } },
      "visual": { "mark": "line", "stroke": "#ff7f0e" }
    }
  ],
  "title": "Angle of Attack & Sideslip"
}
```

---

## 7. Статус и версионирование

**Версия документа:** 1.0  
**Дата фиксации:** 2024  
**Статус:** ✅ **ЗАФИКСИРОВАНО**

**Примечания:**
- Этот документ описывает архитектурный контракт Live UI
- Все решения зафиксированы и не подлежат изменению без отдельного ADR
- Реализация должна соответствовать описанным контрактам

---


### ✅ Решения зафиксированы

Все архитектурные решения, описанные в разделах 1-4, **официально зафиксированы**:

- ✅ Декларативный подход (JSON-конфигурация Layout + ChartSpec)
- ✅ Трёхрегионная структура (Header, Left Panel, Main Panel)
- ✅ Синхронизация через shared_state (time_cursor, selected_run)
- ✅ ChartSpec как универсальная модель для всех типов графиков
- ✅ Статичность layout при работе (обновляются только данные)
- ✅ Window-based ограничение данных (frames/time/all)
- ✅ Observable Plot + D3 как базовые библиотеки визуализации

**Контракты зафиксированы:**
- Layout Contract: JSON Schema v1.0 (иммутабелен во время работы)
- ChartSpec Contract: JSON Schema v1.0 (иммутабелен во время работы)
- WebSocket API Contract: Live Buffer → Event Model (best-effort доставка)

**Ограничения зафиксированы:**
- Layout не поддерживает динамическое добавление/удаление регионов
- ChartSpec не поддерживает runtime изменение типа графика
- Синхронизация работает только для графиков в main_panel

Изменения возможны только через отдельный ADR или новую версию документа.

---

**Следующие шаги:**
1. Реализация Layout и ChartSpec парсеров
2. Реализация React компонентов для регионов
3. Интеграция с Observable Plot
4. WebSocket API для real-time обновлений
5. Валидация через JSON Schema
