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

**Phase 2 — Storage & Analysis** (в проектировании)

Проектирование Phase 2 завершено. См. `docs/11-phase2-design.md`:
- ClickHouse schema для телеметрии
- Batcher API (EventBus → ClickHouse)
- SQL helpers для анализа run'ов

Phase 2 не изменяет архитектурные контракты Phase 1 и не затрагивает live-поток.

## Быстрый старт

### Запуск сервера

```bash
go run cmd/teltel/main.go
```

Сервер запустится на порту 8080 (по умолчанию).

### Endpoints

- `POST /ingest` — приём NDJSON событий от движков
- `GET /api/runs` — список активных run'ов
- `GET /api/run?runId=...` — метаданные run'а
- `GET /api/health` — health check
- `WS /ws` — WebSocket для live-потока событий
- `GET /` — Web UI для визуализации

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
│   ├── api/             # HTTP и WebSocket API
│   └── config/          # Конфигурация
└── web/                 # Frontend (Live UI)
```
