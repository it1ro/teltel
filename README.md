# teltel

`teltel` — локальный телеметрический сервис для симуляторов  
(Flight Engine, Drive Engine, Test Stand).

Цель проекта — предоставить **наблюдаемость, воспроизводимость и анализ**
для физических симуляций без вмешательства в hot‑path движков.

`teltel` — это не логгер и не SaaS.  
Это инженерный инструмент для отладки, анализа и совместной работы
(включая AI‑ассистентов).

---

## Основные идеи

- **Один run = один запуск симуляции**
- **Структурированные события**, а не текстовые логи
- **NDJSON** как основной формат телеметрии
- **EventBus** как внутренний слой маршрутизации
- **ClickHouse** для хранения и анализа
- **Live UI** для наблюдения в реальном времени
- **Cursor AI** как полноценный потребитель данных

---

## Что teltel делает

- принимает телеметрию от движков и стендов
- маршрутизирует события подписчикам
- показывает live‑графики
- сохраняет данные для анализа
- позволяет сравнивать прогоны
- предоставляет удобный API для Cursor

---

## Что teltel НЕ делает

- не управляет симуляцией
- не гарантирует сохранность всех событий
- не является облачным сервисом
- не выполняет агрегации в движке

---

## Как данные попадают в teltel

`teltel` принимает телеметрию от внешних приложений  
(движков, симуляторов, тестовых стендов)
через **HTTP NDJSON‑stream**.

- Endpoint:
  - `POST /api/ingest`
- Content-Type:
  - `application/x-ndjson`
- Каждое событие — **одна строка JSON**
- События отправляются последовательно, без ожидания ответа
- Доставка **best‑effort** (без гарантий)

Типовой жизненный цикл данных:

1. Движок открывает HTTP‑соединение с `/api/ingest`
2. Отправляет событие `run.start`
3. Отправляет события `telemetry` (обычно по кадрам)
4. Отправляет событие `run.end`
5. Соединение закрывается

`teltel` не участвует в логике симуляции  
и не влияет на выполнение движка.

---

## Документация

Основная документация находится в `docs/`.

Рекомендуемый порядок чтения:
1. `docs/00-overview.md`
2. `docs/01-goals-and-non-goals.md`
3. `docs/02-architecture.md`
4. `docs/04-eventbus.md`
5. `docs/03-event-model.md`
6. `docs/05-ingest-and-storage.md`
7. `docs/07-cursor-workflow.md`
8. `docs/08-failure-modes.md`
9. `docs/09-roadmap.md`
10. `docs/10-engineering-validation.md`
11. `docs/ENGINEERING_VALIDATION_GUIDE.md`
12. `docs/ENGINEERING_VALIDATION_RESULTS.md`
13. `docs/11-phase2-design.md`
14. `docs/12-phase3-cursor-examples.md`
15. `docs/PHASE1_FREEZE.md`
16. `docs/PHASE2_FREEZE.md`
17. `docs/PHASE3_FREEZE.md`

**Docker окружение:**
- `DOCKER.md` — руководство по использованию Docker окружения

---

## Статус

**Phase 1 — Core Service (MVP) завершена** (v0.1.0)  
**Phase 2 — Storage & Analysis завершена** (v0.2.0)  
**Phase 3 — UX & Cursor Integration завершена** (v0.3.0)

Все фазы заморожены. Архитектурные контракты не изменяются.

**Engineering Validation — в процессе** (v0.3.0)

---

## Live UI v1 — Architecture Freeze

**Live UI v1 завершена и зафиксирована.**

Live UI v1 предоставляет декларативную систему визуализации телеметрии в реальном времени для teltel. Архитектура версии заморожена и не подлежит изменениям.

### Что входит в Live UI v1

- **Декларативный Layout (JSON Schema v1.0)** — полная структура UI определяется через JSON-конфигурацию
- **Универсальный ChartSpec (JSON Schema v1.0)** — единая модель описания графиков всех типов
- **Shared State Engine** — централизованное управление состоянием (time_cursor, selected_run)
- **Data Layer** — WebSocket подключение, Live Buffer, Window Logic, Data Adapter
- **Chart Engine** — визуализация через Observable Plot (time_series, scatter, histogram)
- **Event Timeline** — визуализация дискретных событий через D3

### Что осознанно не входит в Live UI v1

- ❌ **Пользовательская интерактивность** — click, drag, zoom, hover, tooltip (планируется в следующих версиях)
- ❌ **Analysis UI** — анализ завершённых run'ов (реализован отдельно в `analysis.html`)
- ❌ **Run Overview / Comparison** — сравнение нескольких run'ов (планируется в следующих версиях)

### Архитектурные границы

- Layout и ChartSpec иммутабельны во время работы
- Chart Engine является чистым визуальным слоем (не знает про WebSocket и shared_state)
- Data Layer изолирован от UI и визуализации
- Строгое соответствие архитектурному документу `LIVE_UI_ARCHITECTURE_DESIGN.md`

Подробнее о реализации см. `live-ui/IMPLEMENTATION_STATUS.md`.

---

## Live UI v2 — Architecture Freeze

**Live UI v2 завершена и зафиксирована.**

Live UI v2 является стабильной, завершённой исследовательской средой для анализа run'ов в реальном времени. Архитектура версии заморожена и не подлежит изменениям.

### Что входит в Live UI v2

- **Декларативный Layout и ChartSpec** — полная структура UI определяется через JSON-конфигурацию
- **Shared State Engine** — централизованное управление состоянием (time_cursor, selected_run, интерактивные состояния)
- **Data Layer** — WebSocket подключение, Live Buffer, Window Logic, Data Adapter
- **Chart Engine** — визуализация через Observable Plot (time_series, scatter, histogram)
- **Event Timeline** — визуализация дискретных событий через D3
- **Interaction Layer** — полная интерактивность:
  - Hover & Tooltip — интерактивные подсказки на графиках
  - Time Cursor — интерактивное управление временной позицией (click / drag)
  - Zoom & Pan — навигация по графикам
  - Live Control — управление воспроизведением (Play / Pause)
  - Manual Time Scrubbing — ручной выбор времени через slider
  - Синхронизация интерактивности — координация между графиками

### Архитектурные принципы

- **Декларативность** — Layout и ChartSpec полностью декларативны и иммутабельны во время работы
- **Изоляция слоёв** — Chart Engine является чистым визуальным слоем, Data Layer изолирован от UI
- **Централизованное состояние** — вся интерактивность управляется через shared_state
- **Стабильность** — архитектура доказала стабильность и масштабируемость
- **Строгое соответствие** — все решения соответствуют архитектурному документу `LIVE_UI_ARCHITECTURE_DESIGN.md`

### Что осознанно не входит в Live UI v2

- ❌ **Run Comparison** — сравнение нескольких run'ов (планируется в Stage 8)
- ❌ **Analysis UI** — анализ завершённых run'ов (реализован отдельно в `analysis.html`)
- ❌ **E2E-тесты** — автоматизированное тестирование пользовательских сценариев (планируется в следующих этапах)

Live UI v2 является базой для дальнейшего развития. Все будущие этапы будут строиться на этой архитектуре без изменения контрактов.

Подробнее о реализации см. `live-ui/IMPLEMENTATION_STATUS.md`.  
Руководство пользователя см. `docs/USER_GUIDE.md`.  
Планы дальнейшего развития см. `docs/ROADMAP_NEXT.md`.

---

## Быстрый старт

### Запуск сервера

**Базовый запуск (только live):**
```bash
go run cmd/teltel/main.go
```

**С ClickHouse и Batcher (storage + analysis):**
```bash
go run cmd/teltel/main.go \
  -clickhouse-url=http://localhost:8123 \
  -batcher-enabled=true \
  -batcher-batch-size=10000 \
  -batcher-flush-interval=500ms
```

По умолчанию сервер запускается на порту `8080`.

---

### Docker

```bash
make docker-up
```

Доступ:
- teltel backend: http://localhost:8081
- ClickHouse: http://localhost:8123
- Live UI: http://localhost:3000

**Примечание:** Live UI v2 теперь запускается как отдельный сервис в Docker. Подробнее см. [DOCKER.md](DOCKER.md).

---

### Endpoints

**Web UI:**
- Live UI v2: http://localhost:3000 (отдельный сервис в Docker)
- Legacy UI: `GET /` или `GET /index.html` — старый Live UI (графики реального времени)
- Analysis UI: `GET /analysis.html` — анализ завершённых run'ов

**Ingest API (Phase 1):**
- `POST /api/ingest`
- `GET /api/health`

**Live API (Phase 1):**
- `GET /api/runs`
- `GET /api/run?runId=...`
- `WS /ws`

**Analysis API (Phase 3):**
- `GET /api/analysis/runs`
- `GET /api/analysis/run/{runId}`
- `GET /api/analysis/series`
- `GET /api/analysis/compare`
- `POST /api/analysis/query`

---

## Пример отправки телеметрии

### Интеграция с flight-engine sandbox

**Самый простой способ начать наблюдать за данными в реальном времени:**

1. **Запустите teltel:**
   ```bash
   make docker-up
   ```

2. **Настройте sandbox для отправки данных:**
   ```bash
   cd /path/to/flight-engine/sandbox
   echo "VITE_TELTEL_ENABLED=true" > .env
   ```

3. **Запустите sandbox:**
   ```bash
   npm run sandbox
   ```

4. **Откройте Live UI:**
   - Перейдите на `http://localhost:3000` (Live UI v2 как отдельный сервис)
   - Или `http://localhost:8081` (legacy UI, встроенный в backend)
   - В разделе "Active Runs" вы увидите активный run
   - Кликните на run, чтобы видеть графики в реальном времени
   - Графики обновляются автоматически по мере поступления данных

**Примечание:** После создания `.env` файла необходимо перезапустить dev-сервер Vite.

Подробнее см. [sandbox/README.md](../flight-engine/sandbox/README.md#интеграция-с-teltel).

---

### Node.js / TypeScript (программная отправка)

```ts
import http from "http";

const req = http.request({
  hostname: "localhost",
  port: 8081, // 8080 при локальном запуске
  path: "/api/ingest",
  method: "POST",
  headers: {
    "Content-Type": "application/x-ndjson",
  },
});

req.write(JSON.stringify({
  type: "run.start",
  runId: "run-123",
  timestamp: Date.now(),
}) + "\n");

for (let frame = 1; frame <= 100; frame++) {
  req.write(JSON.stringify({
    type: "telemetry",
    runId: "run-123",
    frameIndex: frame,
    sourceId: "flight-engine",
    payload: {
      altitude: frame * 10,
      speed: Math.random() * 5,
    },
  }) + "\n");
}

req.write(JSON.stringify({
  type: "run.end",
  runId: "run-123",
  timestamp: Date.now(),
}) + "\n");

req.end();
```

**Принципы:**
- best‑effort доставка
- без retry‑логики
- без ожидания ответа сервера
- ошибки доставки не должны влиять на движок

---

## Cursor и анализ данных

`teltel` является источником истины для телеметрии.

При анализе поведения системы рекомендуется:
- запрашивать реальные данные через `/api/analysis/query`
- использовать SQL вместо предположений
- опираться на фактические run'ы и события

Cursor AI рассматривается как полноценный потребитель данных,
а не как внешний наблюдатель.

---

## Тестирование

⚠️ **ВАЖНО: Тесты запускаются ТОЛЬКО через Docker.**  
Локальный `go test` больше не является поддерживаемым способом запуска тестов.

Проект использует integration-тесты для фиксации контрактов компонентов.  
Все тесты выполняются в Docker-контейнере для обеспечения воспроизводимости и идентичности с CI.

**Запуск тестов:**
```bash
# Все тесты (автоматически поднимает ClickHouse и ждёт готовности)
make test

# Быстрый запуск (предполагает, что ClickHouse уже запущен)
make test-fast

# Только тесты storage
make test-storage

# Очистка test-контейнеров
make test-clean
```

**Примеры запуска конкретных тестов:**
```bash
# Тесты конкретного компонента
docker-compose run --rm test go test ./internal/event -v

# С покрытием
docker-compose run --rm test go test ./internal/event -cover

# С дополнительными флагами
docker-compose run --rm test go test ./internal/storage -v -count=1
```

**Текущее покрытие:**
- `internal/event` — integration-тесты для Event Model (валидация, парсинг NDJSON)
- `internal/eventbus` — integration-тесты для EventBus (публикация, фильтрация, backpressure, изоляция подписчиков, статистика)
- `internal/ingest` — integration-тесты для Ingest Handler (HTTP контракт, NDJSON обработка, интеграция с EventBus, wallTime семантика, failure-cases)
- `internal/storage` — integration-тесты для MetadataManager (обновление метаданных из событий, run lifecycle, вычисляемые поля, интеграция с ClickHouse, failure-cases)

Тесты проверяют только публичное поведение компонентов и не используют моки или рефлексию.

**Требования:**
- Docker и docker-compose должны быть установлены
- Тесты автоматически поднимают ClickHouse через docker-compose
- Все тесты выполняются в изолированном контейнере

---

## Структура проекта

```
teltel/
├── cmd/teltel/
├── internal/
│   ├── event/
│   ├── eventbus/
│   ├── ingest/
│   ├── buffer/
│   ├── api/
│   ├── config/
│   └── storage/
├── live-ui/              # Live UI сервис (Vite + React + TypeScript)
│   ├── src/
│   │   ├── schemas/      # JSON Schema контракты
│   │   ├── components/   # React компоненты
│   │   └── utils/        # Loader & Validator
│   ├── Dockerfile        # Multi-stage build для production
│   ├── docker-entrypoint.sh  # Runtime конфигурация
│   ├── nginx.conf        # Nginx конфигурация
│   └── package.json
└── web/                  # Legacy web UI
    ├── live.html
    ├── app.js
    ├── analysis.html
    └── analysis.js
```