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
- teltel: http://localhost:8081
- ClickHouse: http://localhost:8123

---

### Endpoints

⚠️ `teltel` **не обслуживает `/` (root path)**.  
Используйте явные entrypoints.

**Ingest API (Phase 1):**
- `POST /api/ingest`
- `GET /api/health`

**Live API (Phase 1):**
- `GET /api/runs`
- `GET /api/run?runId=...`
- `WS /ws`
- `GET /live.html`

**Analysis API (Phase 3):**
- `GET /api/analysis/runs`
- `GET /api/analysis/run/{runId}`
- `GET /api/analysis/series`
- `GET /api/analysis/compare`
- `POST /api/analysis/query`
- `GET /analysis.html`

---

## Пример отправки телеметрии

### Node.js / TypeScript

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
└── web/
    ├── live.html
    ├── app.js
    ├── analysis.html
    └── analysis.js
