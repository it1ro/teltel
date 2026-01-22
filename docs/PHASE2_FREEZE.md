# Phase 2 Freeze Notice

**Дата заморозки:** 2024 (после завершения Phase 2)  
**Версия:** v0.2.0  
**Статус:** Phase 2 заморожена

---

## Заморозка Phase 2

Phase 2 — Storage & Analysis считается **завершённой и замороженной**.

### Что это означает

1. **Storage контракты не изменяются**
   - ClickHouse schema зафиксирована
   - Batcher API зафиксирован
   - SQL helpers считаются стабильными

2. **Batch-семантика зафиксирована**
   - Flush-условия не меняются
   - Retry политика зафиксирована
   - Формат записи в ClickHouse стабилен

3. **Код Phase 2 стабилен**
   - Реализация соответствует проектированию (`docs/11-phase2-design.md`)
   - Нет экспериментальных заделов
   - Нет временных решений

4. **Изоляция от live-потока сохранена**
   - Batcher работает асинхронно
   - Live-компоненты не зависят от ClickHouse
   - Storage ошибки не влияют на live-поток

### Что можно делать

- **Engineering Validation**: тестирование Phase 1 + Phase 2 под нагрузкой
- **Phase 3**: разработка UX & Cursor Integration на основе Phase 1 + Phase 2
- **Bug fixes**: исправление критических ошибок (только через отдельное решение)

### Что нельзя делать

- Изменять ClickHouse schema без архитектурного решения
- Менять Batcher API или flush-семантику
- Модифицировать SQL helpers без обоснования
- Добавлять функциональность Phase 3 в Phase 2
- Нарушать изоляцию storage от live-потока

### Процесс изменений

Любые изменения Phase 2 возможны только через:

1. **Новую фазу** (Phase 3, Phase 4, etc.)
2. **Отдельное архитектурное решение** (ADR)
3. **Критический bug fix** (с обоснованием)

### Компоненты Phase 2

#### ClickHouse Storage
- Таблица `telemetry_events` — основное хранилище событий
- Таблица `run_metadata` — метаданные run'ов
- Schema Manager — инициализация схемы

#### Batcher
- Подписка на EventBus
- Batch-запись в ClickHouse
- Flush-логика (batch size, interval, run.end)
- Обновление метаданных run'ов

#### SQL Helpers
- Извлечение временных рядов
- Поиск аномалий
- Сравнение run'ов
- Агрегации и корреляционный анализ

### Связанные документы

- `docs/11-phase2-design.md` — проектирование Phase 2
- `docs/09-roadmap.md` — roadmap с описанием фаз
- `docs/PHASE1_FREEZE.md` — заморозка Phase 1
- `internal/storage/README.md` — документация storage пакета
- `ADR/` — архитектурные решения

---

**Phase 2 готова к Engineering Validation и Phase 3.**
