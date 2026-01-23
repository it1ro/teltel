# Live UI v2 Freeze Notice

**Дата заморозки:** 2024 (после завершения Stage 7)  
**Версия:** Live UI v2  
**Статус:** Live UI v2 заморожена

---

## Заморозка Live UI v2

Live UI v2 — Interaction Layer считается **завершённой и замороженной**.

### Что это означает

1. **Архитектурные контракты не изменяются**
   - Layout Contract (JSON Schema v1.0) зафиксирован
   - ChartSpec Contract (JSON Schema v1.0) зафиксирован
   - Shared State Engine контракт стабилен
   - Data Layer API зафиксирован

2. **Interaction Layer зафиксирован**
   - Hover & Tooltip — завершён и стабилен
   - Time Cursor — завершён и стабилен
   - Zoom & Pan — завершён и стабилен
   - Live Control (Play/Pause) — завершён и стабилен
   - Manual Time Scrubbing — завершён и стабилен
   - Синхронизация интерактивности — завершена и стабильна

3. **Архитектурные границы сохранены**
   - Chart Engine остаётся чистым визуальным слоем
   - Data Layer изолирован от UI
   - Shared State Engine — единственный источник состояния
   - Layout и ChartSpec иммутабельны во время работы

4. **Обратная совместимость гарантирована**
   - Все layout'ы Live UI v1 продолжают работать
   - Существующие ChartSpec остаются валидными
   - API не изменяется

5. **Документация зафиксирована**
   - Архитектурный документ стабилен
   - Руководство пользователя завершено
   - Roadmap дальнейшего развития определён

### Что входит в Live UI v2

- ✅ **Декларативный Layout и ChartSpec** — полная структура UI через JSON
- ✅ **Shared State Engine** — централизованное управление состоянием
- ✅ **Data Layer** — WebSocket подключение, Live Buffer, Window Logic, Data Adapter
- ✅ **Chart Engine** — визуализация через Observable Plot (time_series, scatter, histogram)
- ✅ **Event Timeline** — визуализация дискретных событий через D3
- ✅ **Interaction Layer** — полная интерактивность:
  - Hover & Tooltip
  - Time Cursor (click / drag)
  - Zoom & Pan
  - Live Control (Play / Pause)
  - Manual Time Scrubbing
  - Синхронизация интерактивности

### Что осознанно не входит в Live UI v2

- ❌ **Run Comparison** — сравнение нескольких run'ов (планируется в Stage 8)
- ❌ **Analysis UI** — анализ завершённых run'ов (реализован отдельно в `analysis.html`)
- ❌ **E2E-тесты** — автоматизированное тестирование пользовательских сценариев (планируется в следующих этапах)

### Что можно делать

- **Использование Live UI v2** — эксплуатация системы для анализа run'ов
- **Stage 8** — разработка Run Comparison / Analysis UI на базе v2
- **E2E-тесты** — добавление автоматизированного тестирования
- **Bug fixes** — исправление критических ошибок (только через отдельное решение)
- **Performance оптимизации** — улучшение производительности без изменения контрактов

### Что нельзя делать

- Изменять Layout Contract без архитектурного решения
- Изменять ChartSpec Contract без архитектурного решения
- Изменять Shared State Engine контракт без архитектурного решения
- Изменять Data Layer API без архитектурного решения
- Нарушать архитектурные границы (Chart Engine, Data Layer, Shared State)
- Ломать обратную совместимость с Live UI v1

### Архитектурные принципы (неизменны)

1. **Декларативность** — Layout и ChartSpec полностью декларативны
2. **Иммутабельность** — Layout и ChartSpec не изменяются во время работы
3. **Изоляция слоёв** — Chart Engine, Data Layer, Shared State изолированы
4. **Централизованное состояние** — вся интерактивность через shared_state
5. **Стабильность** — архитектура доказала стабильность и масштабируемость

### Контракты (зафиксированы)

- **Layout Contract:** JSON Schema v1.0 (иммутабелен во время работы)
- **ChartSpec Contract:** JSON Schema v1.0 (иммутабелен во время работы)
- **WebSocket API Contract:** Live Buffer → Event Model (best-effort доставка)
- **Shared State Contract:** time_cursor, selected_run, interaction_state, live_mode, hover_state

### Ограничения (зафиксированы)

- Layout не поддерживает динамическое добавление/удаление регионов
- ChartSpec не поддерживает runtime изменение типа графика
- Window не может быть изменён во время работы без перезагрузки графика
- Синхронизация работает только для графиков в main_panel

### Документация

- [Архитектурный документ](../LIVE_UI_ARCHITECTURE_DESIGN.md)
- [Статус реализации](../live-ui/IMPLEMENTATION_STATUS.md)
- [Руководство пользователя](./USER_GUIDE.md)
- [Roadmap дальнейшего развития](./ROADMAP_NEXT.md)

---

## Следующие этапы

После заморозки Live UI v2 возможны следующие этапы:

1. **Stage 8 — Run Comparison / Analysis UI**
   - Сравнение нескольких run'ов
   - Overlay и side-by-side графики
   - Регрессионный анализ
   - Оффлайн-режим

2. **E2E-тесты и стабилизация**
   - E2E-тесты data-flow
   - Тестирование интерактивных сценариев
   - Регрессионная защита
   - Performance-профилирование

Все будущие этапы будут строиться на базе архитектуры Live UI v2 без изменения контрактов.

---

**Live UI v2 зафиксирована и готова к эксплуатации.**
