# Phase 3 Freeze Notice

**Дата заморозки:** 2024 (после завершения Phase 3)  
**Версия:** v0.3.0  
**Статус:** Phase 3 заморожена

---

## Заморозка Phase 3

Phase 3 — UX & Cursor Integration считается **завершённой и замороженной**.

### Что это означает

1. **Analysis API контракты не изменяются**
   - HTTP endpoints зафиксированы
   - Формат ответов (JSONEachRow) стабилен
   - SQL helpers остаются единственным источником аналитической логики

2. **UI контракты зафиксированы**
   - Post-run analysis UI не содержит бизнес-логики
   - UI только отображает данные из ClickHouse
   - SQL запросы всегда видны и копируемы

3. **Read-only доступ к ClickHouse**
   - Analysis API использует только SELECT запросы
   - Никаких изменений storage-схемы
   - Никаких INSERT/UPDATE/DELETE через analysis API

4. **Изоляция от live-потока сохранена**
   - Analysis endpoints не используют live-буферы
   - Live-компоненты не зависят от ClickHouse
   - Storage ошибки не влияют на live-поток

5. **Cursor-friendly workflow зафиксирован**
   - SQL helpers — источник истины
   - Все запросы воспроизводимы
   - Документация примеров стабильна

### Что можно делать

- **Engineering Validation**: тестирование Phase 1 + Phase 2 + Phase 3 под нагрузкой
- **Phase 4**: разработка расширений на основе Phase 1–3
- **Bug fixes**: исправление критических ошибок (только через отдельное решение)

### Что нельзя делать

- Изменять Analysis API endpoints без архитектурного решения
- Добавлять аналитическую логику в UI
- Дублировать SQL helpers в коде UI
- Модифицировать SQL helpers без обоснования
- Добавлять функциональность Phase 4 в Phase 3
- Нарушать изоляцию analysis от live-потока
- Изменять формат ответов API (JSONEachRow)

### Процесс изменений

Любые изменения Phase 3 возможны только через:

1. **Новую фазу** (Phase 4, Phase 5, etc.)
2. **Отдельное архитектурное решение** (ADR)
3. **Критический bug fix** (с обоснованием)

### Компоненты Phase 3

#### ClickHouse Client Extension
- Метод `Query()` для выполнения SELECT запросов
- Возврат raw JSON (JSONEachRow формат)
- Без бизнес-логики, только транспорт

#### Analysis HTTP API
- `GET /api/analysis/runs` — список завершённых run'ов
- `GET /api/analysis/run/{runId}` — метаданные run'а
- `GET /api/analysis/series` — временной ряд
- `GET /api/analysis/compare` — сравнение run'ов
- `POST /api/analysis/query` — произвольный SELECT запрос

Все endpoints:
- Используют только `storage.Client.Query()`
- Не содержат аналитической логики
- Возвращают данные из ClickHouse

#### Post-Run Analysis UI
- Отдельная страница `/analysis.html`
- Навигация по run'ам с фильтрами
- Визуализация временных рядов
- Сравнение run'ов
- Отображение SQL запросов

UI:
- Не содержит бизнес-логики анализа
- Только отображает данные
- SQL запросы всегда видны

#### Cursor Documentation
- `docs/12-phase3-cursor-examples.md` — примеры reasoning
- Типовые инженерные запросы
- Описание API endpoints
- Примеры SQL запросов

### Принципы Phase 3

1. **SQL helpers — источник истины**
   - Вся аналитика в SQL helpers
   - UI только вызывает SQL helpers
   - Никакого дублирования логики

2. **Read-only доступ**
   - Только SELECT запросы
   - Никаких изменений данных
   - Никаких изменений схемы

3. **Прозрачность**
   - SQL запросы всегда видны
   - Результаты воспроизводимы
   - Нет скрытой магии

4. **Изоляция**
   - Analysis не зависит от live-потока
   - Live не зависит от ClickHouse
   - Storage ошибки не влияют на live

### Связанные документы

- `docs/09-roadmap.md` — roadmap с описанием фаз
- `docs/11-phase2-design.md` — проектирование Phase 2
- `docs/12-phase3-cursor-examples.md` — примеры для Cursor
- `docs/PHASE1_FREEZE.md` — заморозка Phase 1
- `docs/PHASE2_FREEZE.md` — заморозка Phase 2
- `internal/storage/sql_helpers.go` — SQL helpers (Phase 2)
- `internal/api/analysis.go` — Analysis API (Phase 3)

---

**Phase 3 готова к Engineering Validation и Phase 4.**
