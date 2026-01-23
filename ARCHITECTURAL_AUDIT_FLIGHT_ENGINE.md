Архитектурный аудит flight-engine
1. API Usage Audit (flight-engine → teltel)
1.1 Текущее использование API teltel
FlightLogger (src/utils/flightLogger.ts)
Статус: ✅ Корректная реализация с незначительными замечаниями

Использование:

HTTP POST к /api/ingest (endpoint по умолчанию: http://localhost:8081/api/ingest)
Формат: NDJSON stream
Content-Type: application/x-ndjson
Соответствие контракту:

✅ Поле v: 1 присутствует
✅ Поле runId присутствует
✅ Поле sourceId: "flight-engine" корректно
✅ Поле channel используется правильно (physics, input, engine, aero, system)
✅ Поле type соответствует контракту (body.state, input.state, engine.state, aero.state, run.start, run.end)
✅ Поля frameIndex, simTime, wallTimeMs присутствуют
⚠️ Поле payload передаётся как JSON.stringify() → строка, но контракт ожидает JSON объект (json.RawMessage)
✅ Частота логирования контролируется (по умолчанию 10 Гц)
Типы событий:

run.start (channel: system) - начало run'а с metadata
body.state (channel: physics) - состояние самолёта (pos, vel, rot, omega)
input.state (channel: input) - управляющие воздействия (raw + processed)
engine.state (channel: engine) - состояние двигателя (propeller/jet)
aero.state (channel: aero) - аэродинамическое состояние
run.end (channel: system) - завершение run'а
Проблемы:

payload сериализуется дважды: сначала в JSON.stringify(), затем в write() через JSON.stringify(event)
Нет обработки ошибок HTTP запроса (silent fail)
Нет проверки валидности endpoint URL при старте
TeltelSink (src/utils/teltelSink.ts)
Статус: ❌ УСТАРЕВШИЙ КОД, НЕ ИСПОЛЬЗУЕТСЯ

Проблемы:

Отсутствует поле v (версия схемы) - нарушение контракта
Отсутствует поле channel - нарушение контракта
Использует type: "telemetry" вместо специфичных типов (body.state, aero.state, etc.)
Использует timestamp вместо wallTimeMs
Использует metadata в корне события вместо payload
Формат не соответствует Event Model teltel
Рекомендация: Удалить файл src/utils/teltelSink.ts (не используется нигде в коде)

1.2 Интеграция FlightLogger
Где используется:

src/world/flightWorldTS.ts - опциональный logger через setLogger() и конструктор
Logger вызывается в update() для логирования:
logInputState() - строки 289-302
logEngineState() - строки 382-409
logAeroState() - строки 462-480
Проблемы интеграции:

FlightLogger не используется в sandbox (sandbox/src/index.ts)
FlightLogger не используется в rig modes (src/rig/modes/flight.ts, src/rig/modes/fall.ts)
FlightLogger не используется в debug mode (src/rig/modes/debug.ts)
Нет способа включить логирование через конфигурацию окружения
1.3 Классификация использования API
| Компонент | Статус | Приоритет | Действие |

|-----------|--------|-----------|----------|

| FlightLogger | ✅ Корректно | High | Исправить двойную сериализацию payload, добавить обработку ошибок |

| TeltelSink | ❌ Устарел | Medium | Удалить (не используется) |

| Интеграция в sandbox | ❌ Отсутствует | Medium | Добавить опциональную интеграцию |

| Интеграция в rig | ❌ Отсутствует | Low | Добавить опциональную интеграцию |

---

2. Debug / Console Audit (flight-engine)
2.1 Инвентаризация console.log
Production код (core engine)
src/world/flightWorldTS.ts:504-510

if (this.diagSimTime < 3) {
  console.log('[sim]', 't', this.diagSimTime.toFixed(2), 'v', v.toFixed(2), 'omega', state.omega, 'M', momentsBody)
}
Классификация: Диагностический лог (первые 3 секунды симуляции)

Приоритет: High

Действие: Заменить на teltel logging через channel system, type debug.diagnostic или удалить

src/aero/moments.ts:142-144

console.log('[mom]', 'omegaYsign', pitchSign, 'pitchMomentSign', pitchMomentSign)
if (pitchSign !== 0 && pitchMomentSign !== 0 && pitchSign === pitchMomentSign) {
  console.warn('[mom][warn] pitch moment sign matches omega.y (reduced damping)')
}
Классификация: Debug-логирование для диагностики стабильности

Приоритет: High

Действие: Заменить на teltel logging через channel aero, type debug.stability или удалить после анализа

Rig / Debug инструменты
src/rig/modes/debug.ts:81,83

console.log('[rig:debug] старт headless режима')
console.log('[rig:debug] завершено')
Классификация: Информационные логи для пользователя (rig инструмент)

Приоритет: Low

Действие: Оставить как есть (rig - инструмент разработчика) или заменить на структурированный лог

src/rig/modes/debug.ts:103

console.log(JSON.stringify(sample))
Классификация: Вывод диагностических данных в stdout (headless режим)

Приоритет: Medium

Действие: Заменить на teltel logging через channel diagnostics или оставить для stdout (headless режим)

src/rig/index.ts:17

console.error(`Неизвестный режим "${arg}". Используйте one of: flight | fall | debug`)
Классификация: Ошибка пользовательского ввода (CLI инструмент)

Приоритет: Low

Действие: Оставить как есть (CLI ошибка)

src/rig/main.ts:25

console.error('Rig UI не смог запуститься:', err)
Классификация: Ошибка инициализации UI

Приоритет: Low

Действие: Оставить как есть (UI ошибка) или улучшить форматирование

Sandbox (UI инструмент)
sandbox/src/index.ts:120-126

console.log('Sandbox initialized')
console.log('Controls:')
console.log('  W/S - Pitch')
// ... инструкции по управлению
Классификация: Пользовательский feedback (инструкции)

Приоритет: Low

Действие: Оставить как есть (UI инструкции) или перенести в UI элемент

sandbox/src/index.ts:131

console.error('Failed to initialize sandbox:', error)
Классификация: Ошибка инициализации

Приоритет: Low

Действие: Оставить как есть (UI ошибка)

2.2 Классификация console.log
| Файл | Строка | Тип | Классификация | Приоритет | Действие |

|------|--------|-----|---------------|-----------|----------|

| src/world/flightWorldTS.ts | 504 | console.log | Диагностика симуляции | High | → teltel или удалить |

| src/aero/moments.ts | 142 | console.log | Debug стабильности | High | → teltel или удалить |

| src/aero/moments.ts | 144 | console.warn | Предупреждение стабильности | High | → teltel или удалить |

| src/rig/modes/debug.ts | 81,83 | console.log | Информация rig | Low | Оставить или структурировать |

| src/rig/modes/debug.ts | 103 | console.log | Диагностика (stdout) | Medium | → teltel или оставить stdout |

| src/rig/index.ts | 17 | console.error | CLI ошибка | Low | Оставить |

| src/rig/main.ts | 25 | console.error | UI ошибка | Low | Оставить |

| sandbox/src/index.ts | 120-126 | console.log | UI инструкции | Low | Оставить или UI |

| sandbox/src/index.ts | 131 | console.error | UI ошибка | Low | Оставить |

2.3 Временные debug флаги и комментарии
src/world/flightWorldTS.ts:489

// TEMP_STABILITY: global angular damping
const angularDamping = 0.5
Классификация: Временный код для стабильности

Приоритет: Medium

Действие: Решить судьбу (оставить как фича или удалить после анализа)

src/aero/moments.ts:135

// DIAG: pitch/yaw aerodynamic damping
Классификация: Диагностический комментарий

Приоритет: Low

Действие: Оставить или уточнить комментарий

src/rig/modes/debug.ts:45

inertia: { x: 8000, y: 12000, z: 9000 }, // DIAG: увеличенная инерция
Классификация: Диагностический комментарий в тестовом коде

Приоритет: Low

Действие: Оставить (debug режим)

---

3. Logging Strategy via teltel
3.1 Типы логов для teltel
Уровни логирования
debug - детальная диагностика (стабильность, моменты, демпфирование)
info - информационные события (run.start, run.end)
warning - предупреждения (стабильность, аномалии)
error - ошибки (не должны быть в production коде движка)
Каналы (channels)
system - системные события (run.start, run.end, debug.diagnostic)
physics - физика (body.state)
input - управление (input.state)
engine - двигатель (engine.state)
aero - аэродинамика (aero.state, debug.stability)
diagnostics - диагностика (для rig debug mode)
3.2 Маппинг console.log → teltel
| Текущий console.log | → teltel событие |

|---------------------|------------------|

| [sim] диагностика (flightWorldTS.ts:504) | channel: "system", type: "debug.diagnostic", payload: { simTime, velocity, omega, moments } |

| [mom] pitch moment (moments.ts:142) | channel: "aero", type: "debug.stability", payload: { omegaYsign, pitchMomentSign } |

| `[mom][warn] reduced damping (moments.ts:144) | `channel: "aero", type: "warning.stability", payload: { message: "pitch moment sign matches omega.y", omegaYsign, pitchMomentSign } |

| [rig:debug] диагностика (debug.ts:103) | channel: "diagnostics", type: "diagnostic.sample", payload: DiagnosticSample |

3.3 Расширение FlightLogger
Новые методы:

logDebug(channel: string, type: string, payload: any): void
logWarning(channel: string, type: string, payload: any): void
logError(channel: string, type: string, payload: any, error?: Error): void
Использование:

logDebug("system", "debug.diagnostic", { simTime, velocity, omega, moments })
logWarning("aero", "warning.stability", { message, omegaYsign, pitchMomentSign })
3.4 Логи для удаления
UI инструкции (sandbox/src/index.ts:120-126) - не логировать, показывать в UI
CLI ошибки (src/rig/index.ts:17, src/rig/main.ts:25) - оставить console.error для CLI
Rig информационные сообщения (src/rig/modes/debug.ts:81,83) - можно оставить или структурировать
---

4. Responsibility Boundaries (flight-engine ↔ teltel)
4.1 Что flight-engine ДОЛЖЕН логировать
✅ Телеметрия полёта:

Состояние самолёта (body.state)
Аэродинамические параметры (aero.state)
Состояние двигателя (engine.state)
Управляющие воздействия (input.state)
✅ Системные события:

run.start - начало симуляции с метаданными
run.end - завершение симуляции
✅ Диагностические события (опционально):

debug.diagnostic - детальная диагностика симуляции
debug.stability - диагностика стабильности
warning.stability - предупреждения о проблемах стабильности

4.2 Что flight-engine НЕ должен логировать
❌ Пользовательские сообщения:

Инструкции по управлению (должны быть в UI)
Информационные сообщения для пользователя (должны быть в UI)
❌ CLI-специфичные логи:

Ошибки парсинга аргументов командной строки (console.error для CLI)
Сообщения о запуске/завершении rig инструментов (console.log для CLI)
❌ Временные debug-логи:

Временные диагностические логи, которые не нужны в production
Логи, которые дублируют информацию из телеметрии
❌ Текстовые сообщения:

События не должны содержать "человеческих" текстовых сообщений
Все данные должны быть структурированными (payload как JSON объект)

4.3 Границы между локальной диагностикой и системным логированием
Локальная диагностика (console.log/console.error) допустима для:

CLI инструменты (rig) - ошибки и информационные сообщения
UI инструменты (sandbox) - ошибки инициализации
Временная отладка во время разработки
Системное логирование через teltel обязательно для:

Телеметрия полёта (body.state, aero.state, engine.state, input.state)
Системные события (run.start, run.end)
Диагностика стабильности (если требуется для анализа)
Предупреждения о проблемах (warning.stability)
Где проходит граница:

Если данные нужны для анализа через Cursor или ClickHouse → teltel
Если данные нужны только для локальной отладки → console.log (временно)
Если данные нужны пользователю → UI, не логирование

4.4 Debug-сценарии через события vs console.log
Вместо console.log использовать события:

Диагностика стабильности → channel: "aero", type: "debug.stability"
Диагностика симуляции → channel: "system", type: "debug.diagnostic"
Диагностика rig → channel: "diagnostics", type: "diagnostic.sample"
Вместо console.warn использовать warning события:

Предупреждения стабильности → channel: "aero", type: "warning.stability"
Преимущества:

Данные доступны в ClickHouse для анализа
Данные доступны через Cursor для анализа
Данные можно фильтровать по runId, channel, type
Данные синхронизированы с телеметрией по frameIndex и simTime

---

5. Action Plan (План рефакторинга)

5.1 Приоритеты и этапы
Этап 1: Критические исправления (High Priority)
Цель: Исправить нарушения контракта и критические проблемы

Задачи:
1. Исправить двойную сериализацию payload в FlightLogger
   - Файл: src/utils/flightLogger.ts
   - Проблема: payload сериализуется дважды (JSON.stringify() → строка, затем JSON.stringify(event))
   - Решение: payload должен быть объектом, сериализация только в write()
   - Приоритет: High

2. Добавить обработку ошибок HTTP запроса в FlightLogger
   - Файл: src/utils/flightLogger.ts
   - Проблема: silent fail при ошибках HTTP
   - Решение: добавить обработчики ошибок и событий 'error', 'timeout' на req
   - Приоритет: High

3. Добавить валидацию endpoint URL в FlightLogger
   - Файл: src/utils/flightLogger.ts
   - Проблема: нет проверки валидности URL при старте
   - Решение: валидировать URL в конструкторе или start()
   - Приоритет: High

4. Удалить устаревший TeltelSink
   - Файл: src/utils/teltelSink.ts
   - Проблема: не используется, нарушает контракт
   - Решение: удалить файл
   - Приоритет: Medium

Этап 2: Замена console.log на teltel logging (High Priority)
Цель: Перевести диагностические логи на teltel

Задачи:
1. Расширить FlightLogger методами для debug/warning/error
   - Файл: src/utils/flightLogger.ts
   - Добавить методы: logDebug(), logWarning(), logError()
   - Приоритет: High

2. Заменить диагностический лог в flightWorldTS.ts
   - Файл: src/world/flightWorldTS.ts:504-510
   - Заменить console.log на logger.logDebug("system", "debug.diagnostic", {...})
   - Приоритет: High

3. Заменить debug-логи в moments.ts
   - Файл: src/aero/moments.ts:142-144
   - Заменить console.log на logger.logDebug("aero", "debug.stability", {...})
   - Заменить console.warn на logger.logWarning("aero", "warning.stability", {...})
   - Приоритет: High

Этап 3: Интеграция FlightLogger в sandbox и rig (Medium Priority)
Цель: Добавить возможность включения логирования через конфигурацию

Задачи:
1. Добавить опциональную интеграцию FlightLogger в sandbox
   - Файл: sandbox/src/index.ts
   - Добавить создание FlightLogger через env переменные или конфиг
   - Передать logger в WorldManager
   - Приоритет: Medium

2. Добавить опциональную интеграцию FlightLogger в rig modes
   - Файлы: src/rig/modes/flight.ts, src/rig/modes/fall.ts, src/rig/modes/debug.ts
   - Добавить создание FlightLogger через env переменные
   - Передать logger в WorldManager
   - Приоритет: Medium

3. Добавить поддержку env переменных для конфигурации
   - Переменные: TELTEL_ENABLED, TELTEL_ENDPOINT, TELTEL_RUN_ID
   - Приоритет: Medium

Этап 4: Обработка rig debug mode (Medium Priority)
Цель: Решить судьбу диагностических логов в rig debug mode

Задачи:
1. Решить: teltel logging или stdout для rig debug mode
   - Файл: src/rig/modes/debug.ts:103
   - Вариант A: Заменить на teltel logging (channel: "diagnostics")
   - Вариант B: Оставить stdout для headless режима
   - Приоритет: Medium

2. Структурировать информационные логи rig
   - Файл: src/rig/modes/debug.ts:81,83
   - Оставить console.log или заменить на структурированный лог
   - Приоритет: Low

Этап 5: Очистка и финализация (Low Priority)
Цель: Удалить временный код и улучшить документацию

Задачи:
1. Решить судьбу TEMP_STABILITY кода
   - Файл: src/world/flightWorldTS.ts:489
   - Оставить как фичу или удалить после анализа
   - Приоритет: Medium

2. Уточнить диагностические комментарии
   - Файл: src/aero/moments.ts:135
   - Уточнить или оставить комментарий
   - Приоритет: Low

3. Обновить документацию
   - Обновить README.md с информацией о teltel интеграции
   - Обновить STABILITY_ANALYSIS.md если нужно
   - Приоритет: Low

5.2 Детальный план выполнения

Фаза 1: Исправление FlightLogger (1-2 дня)
1. Исправить двойную сериализацию payload
2. Добавить обработку ошибок HTTP
3. Добавить валидацию endpoint URL
4. Протестировать исправления

Фаза 2: Расширение FlightLogger (1 день)
1. Добавить методы logDebug(), logWarning(), logError()
2. Протестировать новые методы

Фаза 3: Замена console.log (1 день)
1. Заменить console.log в flightWorldTS.ts
2. Заменить console.log/warn в moments.ts
3. Протестировать замену

Фаза 4: Интеграция в sandbox/rig (2-3 дня)
1. Добавить поддержку env переменных
2. Интегрировать в sandbox
3. Интегрировать в rig modes
4. Протестировать интеграцию

Фаза 5: Очистка (1 день)
1. Удалить TeltelSink
2. Решить судьбу TEMP_STABILITY
3. Обновить документацию

5.3 Риски и митигация
Риск: Нарушение работы существующего кода
Митигация: Все изменения опциональны (enabled по умолчанию false)

Риск: Производительность при включенном логировании
Митигация: Логирование асинхронное, не блокирует hot-path

Риск: Потеря данных при ошибках HTTP
Митигация: Добавить обработку ошибок и retry логику (опционально)

5.4 Критерии успеха
✅ FlightLogger полностью соответствует контракту teltel
✅ Все диагностические console.log заменены на teltel logging
✅ FlightLogger интегрирован в sandbox и rig (опционально)
✅ Устаревший код удалён
✅ Документация обновлена

5.5 Отложенные задачи (можно сделать позже)
- Добавить retry логику для HTTP запросов
- Добавить метрики производительности логирования
- Добавить поддержку batch отправки событий
- Добавить поддержку WebSocket для real-time логирования
- Добавить поддержку фильтрации событий на клиенте

---

## Итоговая сводка

### Статус аудита
✅ API Usage Audit - завершён
✅ Debug / Console Audit - завершён
✅ Logging Strategy - завершён
✅ Responsibility Boundaries - завершён
✅ Action Plan - завершён

### Ключевые находки
1. FlightLogger в целом корректен, но требует исправления двойной сериализации payload
2. TeltelSink устарел и должен быть удалён
3. 3 критических console.log требуют замены на teltel logging
4. FlightLogger не интегрирован в sandbox и rig
5. Нет способа включить логирование через конфигурацию

### Приоритеты рефакторинга
- High: Исправление FlightLogger, замена console.log
- Medium: Интеграция в sandbox/rig, удаление TeltelSink
- Low: Очистка временного кода, обновление документации

### Оценка времени
Общее время рефакторинга: 6-8 дней
- Фаза 1-2: 2-3 дня (критические исправления)
- Фаза 3-4: 3-4 дня (интеграция)
- Фаза 5: 1 день (очистка)