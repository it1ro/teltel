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

**Web UI:**
- `GET /` или `GET /index.html` — Live UI (графики реального времени)
- `GET /analysis.html` — Analysis UI (анализ завершённых run'ов)

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

4. **Откройте UI teltel:**
   - Перейдите на `http://localhost:8081`
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
│   └── package.json
└── web/                  # Legacy web UI
    ├── live.html
    ├── app.js
    ├── analysis.html
    └── analysis.js
```