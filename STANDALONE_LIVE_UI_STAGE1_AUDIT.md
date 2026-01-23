# Аудит зависимостей: Live UI v2 → Backend

**Дата проведения:** 2024  
**Ветка:** `feature/standalone-live-ui-stage1-audit`  
**Этап:** Этап 1 - Подготовка (Audit зависимостей)

---

## Резюме

Проведён полный аудит зависимостей между Live UI v2 и backend. Результаты показывают, что архитектурные границы соблюдены, прямых зависимостей от backend кода нет. Все интеграции происходят через явные контракты (WebSocket API, Event Model).

---

## 1. Зависимости от backend кода

### 1.1 Прямые импорты

**Результат:** ❌ Прямых импортов не обнаружено

**Проверка:**
- Поиск импортов из `../..` (выход за пределы live-ui/)
- Поиск импортов из backend директорий
- Анализ всех TypeScript файлов в `live-ui/src/`

**Вывод:** Все импорты относительные внутри `live-ui/src/`. Нет импортов из backend Go кода или shared модулей.

---

### 1.2 Shared код

**Результат:** ❌ Shared кода не обнаружено

**Проверка:**
- Поиск shared TypeScript модулей
- Поиск shared Go модулей
- Проверка общих директорий

**Вывод:** Нет shared кода между backend и frontend. Типы дублируются (см. раздел 2.1).

---

### 1.3 Зависимость от backend бинарника

**Результат:** ❌ Зависимости от бинарника нет

**Проверка:**
- Анализ package.json
- Анализ сборки (vite.config.ts)
- Проверка runtime зависимостей

**Вывод:** Live UI - полностью standalone приложение. Не требует backend бинарник для работы.

---

## 2. Дублирование типов

### 2.1 Event Model

**Статус:** ✅ Дублируется (ожидаемо)

**Backend (Go):**
- Файл: `internal/event/event.go`
- Структура: `Event` с полями `V`, `RunID`, `SourceID`, `Channel`, `Type`, `FrameIndex`, `SimTime`, `WallTimeMs`, `Tags`, `Payload`
- JSON теги: `json:"v"`, `json:"runId"`, и т.д.

**Frontend (TypeScript):**
- Файл: `live-ui/src/data/types.ts`
- Интерфейс: `Event` с полями `v`, `runId`, `sourceId`, `channel`, `type`, `frameIndex`, `simTime`, `wallTimeMs`, `tags`, `payload`
- Валидация: функция `validateEvent()`

**Сравнение:**
- ✅ Структура полностью соответствует
- ✅ JSON поля совпадают
- ⚠️ Типы дублируются (не shared)
- ✅ Валидация на стороне UI

**Риск:** Рассинхронизация при изменении Event Model  
**Митигация:** Документирование контракта, версионирование (этап 3)

---

### 2.2 WSRequest

**Статус:** ✅ Дублируется (ожидаемо)

**Backend (Go):**
- Файл: `internal/api/websocket.go:48-54`
- Структура: `WSRequest` с полями `RunID`, `SourceID`, `Channel`, `Types`, `Tags`
- JSON теги: `json:"runId,omitempty"`, и т.д.

**Frontend (TypeScript):**
- Файл: `live-ui/src/data/types.ts:54-60`
- Интерфейс: `WSRequest` с полями `runId?`, `sourceId?`, `channel?`, `types?`, `tags?`

**Сравнение:**
- ✅ Структура полностью соответствует
- ✅ JSON поля совпадают
- ⚠️ Типы дублируются (не shared)

**Риск:** Рассинхронизация при изменении WSRequest  
**Митигация:** Документирование контракта (см. раздел 3)

---

## 3. WebSocket API контракт

### 3.1 Endpoint

**URL:** `/ws`  
**Протокол:** WebSocket (ws:// или wss://)  
**Метод подключения:** Стандартный WebSocket handshake

**Backend:**
- Файл: `internal/api/websocket.go:58`
- Handler: `WSHandler.HandleWebSocket()`
- Регистрация: `cmd/teltel/main.go:145` - `mux.HandleFunc("/ws", wsHandler.HandleWebSocket)`

**Frontend:**
- Файл: `live-ui/src/data/websocket.ts:76`
- Клиент: `WSClient` класс
- URL: захардкожен `ws://localhost:8080/ws` (⚠️ проблема)

---

### 3.2 Протокол подключения

**Шаг 1: Установка соединения**
1. Клиент открывает WebSocket соединение к `/ws`
2. Backend обновляет соединение через `websocket.Upgrader`
3. CORS: разрешён для всех origin (dev-режим)

**Шаг 2: Отправка запроса на подписку**
1. Клиент отправляет JSON сообщение с `WSRequest`
2. Backend читает запрос через `conn.ReadJSON(&req)`
3. Backend создаёт фильтр из запроса
4. Backend создаёт подписку на EventBus с policy `drop_old`

**Шаг 3: Получение событий**
1. Backend отправляет события из подписки через `conn.WriteJSON(event)`
2. Клиент получает события через `ws.onmessage`
3. Клиент парсит JSON и валидирует через `validateEvent()`

**Шаг 4: Поддержание соединения**
- Backend отправляет ping каждые 54 секунды (pingPeriod)
- Клиент должен отвечать pong (автоматически браузером)
- Timeout: 60 секунд (pongWait)

**Шаг 5: Закрытие соединения**
- При закрытии клиента backend закрывает подписку
- При закрытии backend клиент пытается переподключиться (если включено)

---

### 3.3 Структура WSRequest

```typescript
interface WSRequest {
  runId?: string;        // Фильтр по runId
  sourceId?: string;      // Фильтр по sourceId
  channel?: string;      // Фильтр по channel
  types?: string[];       // Фильтр по типам событий
  tags?: Record<string, string>; // Фильтр по тегам (все должны совпадать)
}
```

**Пример запроса:**
```json
{
  "runId": "run-123",
  "channel": "physics",
  "types": ["body.state", "frame.start"]
}
```

**Backend обработка:**
- Преобразуется в `eventbus.Filter`
- Все поля опциональны (omitempty)
- Если поле не указано, фильтр не применяется

---

### 3.4 Структура Event

```typescript
interface Event {
  v: number;                    // Версия схемы (обязательно)
  runId: string;                // ID запуска (обязательно)
  sourceId: string;             // ID источника (обязательно)
  channel: string;               // Канал (обязательно)
  type: string;                 // Тип события (обязательно)
  frameIndex: number;            // Индекс кадра (>= 0)
  simTime: number;              // Симуляционное время (>= 0)
  wallTimeMs?: number | null;    // Время на хосте (опционально)
  tags?: Record<string, string>; // Теги (опционально)
  payload: unknown;              // JSON payload (обязательно, не парсится)
}
```

**Пример события:**
```json
{
  "v": 1,
  "runId": "run-123",
  "sourceId": "flight-engine",
  "channel": "physics",
  "type": "body.state",
  "frameIndex": 100,
  "simTime": 1.23,
  "wallTimeMs": 1730000000000,
  "tags": { "component": "main" },
  "payload": { "x": 10.5, "y": 20.3, "z": 30.1 }
}
```

**Валидация:**
- Backend: `Event.Validate()` в `internal/event/event.go:43`
- Frontend: `validateEvent()` в `live-ui/src/data/types.ts:22`

---

### 3.5 Обработка ошибок

**Ошибки подключения:**
- Backend: логирует ошибку, закрывает соединение
- Frontend: вызывает `onError` callback, пытается переподключиться

**Ошибки парсинга:**
- Backend: логирует ошибку, закрывает соединение
- Frontend: валидирует через `validateEvent()`, игнорирует невалидные события

**Ошибки отправки:**
- Backend: логирует ошибку, закрывает соединение
- Frontend: вызывает `onError` callback

**Backpressure:**
- Backend: использует policy `drop_old` для UI подписок
- Buffer size: 2048 событий
- Старые события удаляются при переполнении

---

## 4. Точки интеграции

### 4.1 WebSocket подключение

**Точка интеграции:** WebSocket endpoint `/ws`

**Зависимости:**
- URL: захардкожен `ws://localhost:8080/ws` (⚠️ проблема)
- Протокол: JSON over WebSocket
- Контракт: WSRequest → поток Event

**Файлы:**
- Backend: `internal/api/websocket.go`
- Frontend: `live-ui/src/data/websocket.ts`, `live-ui/src/data/layer.ts`

**Статус:** ✅ Работает, но требует конфигурации (этап 2)

---

### 4.2 Layout загрузка

**Точка интеграции:** Статический файл `/example-layout.json`

**Зависимости:**
- Путь: захардкожен `/example-layout.json` (⚠️ проблема)
- Формат: JSON с полями `layout` и опционально `charts`
- Валидация: через JSON Schema (`live-ui/src/schemas/layout.schema.json`)

**Файлы:**
- Frontend: `live-ui/src/App.tsx:28`, `live-ui/src/utils/loader.ts`
- Backend: нет (статический файл)

**Статус:** ✅ Работает, но требует API endpoint (опционально, этап 2)

---

### 4.3 Event Model

**Точка интеграции:** JSON структура Event

**Зависимости:**
- Структура: дублируется в Go и TypeScript
- Валидация: на обеих сторонах
- Версионирование: поле `v` (текущая версия: 1)

**Файлы:**
- Backend: `internal/event/event.go`
- Frontend: `live-ui/src/data/types.ts`
- Документация: `docs/03-event-model.md`

**Статус:** ✅ Работает, требует документирования контракта (выполнено)

---

## 5. Конфигурация

### 5.1 WebSocket URL

**Текущее состояние:** ❌ Захардкожен

**Местоположение:** `live-ui/src/data/websocket.ts:24`
```typescript
const DEFAULT_OPTIONS: Required<WSClientOptions> = {
  url: 'ws://localhost:8080/ws',  // ⚠️ захардкожен
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
};
```

**Проблема:** Невозможно настроить URL для разных окружений (dev/prod/Docker)

**Решение:** Этап 2 - добавить поддержку `VITE_WS_URL` или runtime конфигурации

---

### 5.2 Layout URL

**Текущее состояние:** ❌ Захардкожен

**Местоположение:** `live-ui/src/App.tsx:28`
```typescript
const response = await fetch('/example-layout.json');  // ⚠️ захардкожен
```

**Проблема:** Нет возможности загружать layout из backend API

**Решение:** Этап 2 - добавить поддержку `VITE_LAYOUT_URL` или runtime конфигурации (опционально)

---

### 5.3 Environment variables

**Текущее состояние:** ❌ Не используются

**Проверка:**
- Поиск `VITE_*` переменных: не найдено
- Поиск `REACT_APP_*` переменных: не найдено
- Поиск `import.meta.env`: не найдено

**Проблема:** Нет механизма конфигурации через environment variables

**Решение:** Этап 2 - добавить поддержку Vite environment variables

---

### 5.4 Vite конфигурация

**Файл:** `live-ui/vite.config.ts`

**Текущее состояние:**
- Порт dev-сервера: 3000 (захардкожен)
- Нет настроек для environment variables
- Нет настроек для production build paths

**Статус:** ✅ Базовая конфигурация работает, требует расширения (этап 2)

---

## 6. Отсутствующие зависимости

### ✅ Нет прямых импортов из backend кода
- Проверено: все импорты относительные внутри `live-ui/src/`
- Нет импортов из `../..` или backend директорий

### ✅ Нет shared TypeScript/Go модулей
- Проверено: нет общих директорий или модулей
- Типы дублируются (ожидаемо)

### ✅ Нет зависимости от backend бинарника
- Проверено: Live UI - standalone приложение
- Не требует backend для сборки или работы

### ✅ Нет прямого доступа к ClickHouse
- Проверено: нет импортов или зависимостей от ClickHouse
- Все данные получаются через WebSocket

---

## 7. Выводы

### 7.1 Архитектурные границы

**Статус:** ✅ Соблюдены

- Нет прямых зависимостей от backend кода
- Все интеграции через явные контракты (WebSocket API)
- Типы дублируются (не shared)

---

### 7.2 Точки интеграции

**Количество:** 3 основные точки

1. **WebSocket API** (`/ws`) - основная точка интеграции
2. **Layout загрузка** (статический файл) - опциональная
3. **Event Model** (JSON структура) - контракт данных

**Статус:** ✅ Все точки интеграции явные и документированы

---

### 7.3 Проблемы для решения

**Критические:**
1. ❌ WebSocket URL захардкожен → Этап 2
2. ❌ Layout URL захардкожен → Этап 2 (опционально)

**Некритические:**
1. ⚠️ Event Model типы дублируются → Документировано, версионирование (этап 3)

---

### 7.4 Готовность к выделению в сервис

**Статус:** ✅ Готово (после этапа 2)

**Требования:**
- ✅ Архитектурные границы соблюдены
- ✅ Нет прямых зависимостей
- ❌ Конфигурация через env vars (этап 2)
- ✅ WebSocket контракт документирован

---

## 8. Рекомендации

### 8.1 Немедленные действия (Этап 2)

1. **Добавить поддержку VITE_WS_URL**
   - Использовать `import.meta.env.VITE_WS_URL`
   - Fallback на `ws://localhost:8080/ws` для dev-режима
   - Runtime конфигурация для production (config.js)

2. **Добавить поддержку VITE_LAYOUT_URL** (опционально)
   - Использовать `import.meta.env.VITE_LAYOUT_URL`
   - Fallback на `/example-layout.json`

3. **Обновить документацию**
   - Документировать переменные окружения
   - Создать `.env.example`

---

### 8.2 Будущие улучшения (Этап 3+)

1. **Версионирование WebSocket API контракта**
   - Добавить версию в WSRequest
   - Поддержка нескольких версий контракта

2. **API endpoint для layout**
   - Создать `/api/layout` endpoint в backend
   - Использовать вместо статического файла

3. **Мониторинг и логирование**
   - Добавить correlation IDs
   - Логирование подключений

---

## 9. Приложения

### 9.1 Список проверенных файлов

**Backend:**
- `internal/api/websocket.go` - WebSocket handler
- `internal/event/event.go` - Event Model
- `internal/api/http.go` - HTTP router

**Frontend:**
- `live-ui/src/data/websocket.ts` - WebSocket client
- `live-ui/src/data/types.ts` - Event Model типы
- `live-ui/src/data/layer.ts` - Data Layer
- `live-ui/src/App.tsx` - Главный компонент
- `live-ui/src/utils/loader.ts` - Layout loader
- `live-ui/vite.config.ts` - Vite конфигурация
- `live-ui/package.json` - Зависимости

---

### 9.2 Ссылки на документацию

- [Event Model](docs/03-event-model.md) - документация Event Model
- [WebSocket API](internal/api/websocket.go) - backend реализация
- [Roadmap](STANDALONE_LIVE_UI_2_SERVICE_ROADMAP.md) - план миграции

---

**Аудит завершён:** 2024  
**Следующий этап:** Этап 2 - Конфигурационная изоляция
