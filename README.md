# teltel

`teltel` — локальный телеметрический сервис для симуляторов
(Flight Engine, Drive Engine, Test Stand).

Цель проекта — предоставить **наблюдаемость, воспроизводимость и анализ**
для физических симуляций без вмешательства в hot-path движков.

teltel — это не логгер и не SaaS.
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
10. `docs/10-engineering-validation.md` (для инженерного тестирования)
11. `docs/11-phase2-design.md` (проектирование Phase 2)
12. `docs/12-phase3-cursor-examples.md` (примеры для Cursor, Phase 3)
13. `docs/PHASE1_FREEZE.md` (заморозка Phase 1)
14. `docs/PHASE2_FREEZE.md` (заморозка Phase 2)

---

## Статус

**Phase 1 — Core Service (MVP) завершена** (v0.1.0)

Реализован работающий локальный сервис с:
- HTTP ingest для NDJSON событий
- In-process EventBus с синхронным fan-out
- Live Buffer с ring buffer per run
- WebSocket API для live-потока событий
- Минимальный Live UI с жёстко заданными series

**Phase 1 заморожена** и готова к:
- Engineering Validation (инженерное тестирование)
- Phase 2 (Storage & Analysis)

Архитектурные контракты Phase 1 не изменяются.

**Phase 2 — Storage & Analysis завершена** (v0.2.0)

Реализовано:
- ClickHouse schema для телеметрии (`telemetry_events`, `run_metadata`)
- Batcher для асинхронной записи событий в ClickHouse
- SQL helpers для анализа run'ов (series, аномалии, сравнения)

**Phase 2 заморожена** и готова к:
- Engineering Validation (инженерное тестирование с storage)
- Phase 3 (UX & Cursor Integration)

Storage контракты Phase 2 не изменяются. Phase 2 полностью изолирована от live-потока.

**Phase 3 — UX & Cursor Integration завершена** (v0.3.0)

Реализовано:
- Post-run анализ UI поверх ClickHouse
- HTTP API для анализа завершённых run'ов
- Визуализация временных рядов, сравнение run'ов
- Cursor-friendly workflow с воспроизводимыми SQL запросами
- Документация примеров reasoning для Cursor

**Phase 3 заморожена** и готова к:
- Engineering Validation (инженерное тестирование с полным стеком)
- Phase 4 (Extensions, опционально)

Phase 3 не изменяет контракты Phase 1 и Phase 2. Все данные для анализа загружаются только из ClickHouse.

## Быстрый старт

### Запуск сервера

**Базовый запуск (только Phase 1 — live):**
```bash
go run cmd/teltel/main.go
```

**С ClickHouse и Batcher (Phase 2/3 — storage и analysis):**
```bash
go run cmd/teltel/main.go \
  -clickhouse-url=http://localhost:8123 \
  -batcher-enabled=true \
  -batcher-batch-size=10000 \
  -batcher-flush-interval=500ms
```

Сервер запустится на порту 8080 (по умолчанию).

**Примечание:** Для работы Analysis API требуется запущенный ClickHouse и включённый Batcher.

### Endpoints

**Live API (Phase 1):**
- `POST /ingest` — приём NDJSON событий от движков
- `GET /api/runs` — список активных run'ов (из live-буферов)
- `GET /api/run?runId=...` — метаданные run'а (из live-буферов)
- `GET /api/health` — health check
- `WS /ws` — WebSocket для live-потока событий
- `GET /` — Live UI для визуализации в реальном времени

**Analysis API (Phase 3, требует ClickHouse):**
- `GET /api/analysis/runs` — список завершённых run'ов из ClickHouse
- `GET /api/analysis/run/{runId}` — метаданные run'а из ClickHouse
- `GET /api/analysis/series` — временной ряд для run'а
- `GET /api/analysis/compare` — сравнение двух run'ов
- `POST /api/analysis/query` — выполнение произвольного SELECT запроса
- `GET /analysis.html` — Post-run Analysis UI

### Пример отправки события

```bash
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/x-ndjson" \
  -d '{"v":1,"runId":"test-run","sourceId":"flight-engine","channel":"physics","type":"body.state","frameIndex":0,"simTime":0.0,"payload":{"body":{"state":{"pos":{"x":0,"y":0,"z":0}}}}}'
```

## Структура проекта

```
teltel/
├── cmd/teltel/          # Главное приложение
├── internal/
│   ├── event/           # Модель событий и парсинг NDJSON
│   ├── eventbus/        # In-process EventBus
│   ├── ingest/          # HTTP ingest handler
│   ├── buffer/          # Live Buffer (ring buffer per run)
│   ├── api/             # HTTP и WebSocket API (Phase 1/3)
│   ├── config/          # Конфигурация
│   └── storage/         # ClickHouse storage (Phase 2)
└── web/                 # Frontend
    ├── index.html       # Live UI (Phase 1)
    ├── app.js           # Live UI logic
    ├── analysis.html    # Post-run Analysis UI (Phase 3)
    └── analysis.js      # Analysis UI logic
```
