# teltel

`teltel` — локальный телеметрический сервис для симуляторов  
(Flight Engine, Drive Engine, Test Stand).

Цель проекта — предоставить **наблюдаемость, воспроизводимость и анализ**
для физических симуляций без вмешательства в hot‑path движков.

`teltel` — это не логгер и не SaaS.  
Это инженерный инструмент для отладки, анализа и совместной работы
(включая AI‑ассистентов).

---

## Что это

`teltel` — это локальный телеметрический сервис для симуляторов, предоставляющий наблюдаемость, воспроизводимость и анализ для физических симуляций без вмешательства в hot‑path движков.

**Основные идеи:**
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

**Для начала работы:**
- [docs/00-overview.md](docs/00-overview.md) — обзор проекта
- [docs/01-goals-and-non-goals.md](docs/01-goals-and-non-goals.md) — цели и ограничения
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — руководство пользователя

**Архитектура и дизайн:**
- [docs/02-architecture.md](docs/02-architecture.md) — архитектура системы
- [docs/03-event-model.md](docs/03-event-model.md) — модель событий
- [docs/04-eventbus.md](docs/04-eventbus.md) — EventBus
- [docs/05-ingest-and-storage.md](docs/05-ingest-and-storage.md) — ingest и storage
- [LIVE_UI_ARCHITECTURE_DESIGN.md](LIVE_UI_ARCHITECTURE_DESIGN.md) — архитектура Live UI
- [live-ui/IMPLEMENTATION_STATUS.md](live-ui/IMPLEMENTATION_STATUS.md) — статус реализации Live UI

**API и интеграция:**
- [docs/API.md](docs/API.md) — полная документация API
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — примеры интеграции
- [docs/07-cursor-workflow.md](docs/07-cursor-workflow.md) — работа с Cursor AI

**Операции и тестирование:**
- [DOCKER.md](DOCKER.md) — Docker окружение
- [docs/TESTING.md](docs/TESTING.md) — тестирование
- [docs/08-failure-modes.md](docs/08-failure-modes.md) — failure modes

**Статус и планы:**
- [docs/STATUS.md](docs/STATUS.md) — текущий статус проекта
- [docs/09-roadmap.md](docs/09-roadmap.md) — roadmap

---

## Быстрый старт

### Локальный запуск

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

### Docker

```bash
make docker-up
```

Подробнее о Docker окружении см. [DOCKER.md](DOCKER.md).

---

## Где искать информацию

**Хочу начать использовать teltel:**
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — руководство пользователя с примерами
- [docs/API.md](docs/API.md) — документация API endpoints

**Хочу понять архитектуру:**
- [docs/02-architecture.md](docs/02-architecture.md) — архитектура системы
- [docs/03-event-model.md](docs/03-event-model.md) — модель событий
- [docs/04-eventbus.md](docs/04-eventbus.md) — EventBus
- [LIVE_UI_ARCHITECTURE_DESIGN.md](LIVE_UI_ARCHITECTURE_DESIGN.md) — архитектура Live UI
- [live-ui/IMPLEMENTATION_STATUS.md](live-ui/IMPLEMENTATION_STATUS.md) — статус реализации Live UI

**Хочу интегрировать с Cursor AI:**
- [docs/07-cursor-workflow.md](docs/07-cursor-workflow.md) — работа с Cursor AI
- [docs/12-phase3-cursor-examples.md](docs/12-phase3-cursor-examples.md) — примеры использования

**Хочу запустить тесты:**
- [docs/TESTING.md](docs/TESTING.md) — тестирование

**Хочу узнать текущий статус проекта:**
- [docs/STATUS.md](docs/STATUS.md) — статус проекта
- [docs/09-roadmap.md](docs/09-roadmap.md) — планы развития
