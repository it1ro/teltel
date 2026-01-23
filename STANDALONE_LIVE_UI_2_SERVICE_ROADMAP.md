Roadmap: Выделение Live UI v2 в отдельный сервис
Цель
Выделить Live UI v2 в отдельный сервис, управляемый через docker-compose, без нарушения архитектурных границ и с сохранением обратной совместимости.

---

1. Текущая архитектура (AS-IS)
1.1 Положение Live UI в системе
Текущее состояние:

Live UI v2 находится в директории live-ui/ как отдельный Vite + React проект
Запускается отдельно через npm run dev на порту 3000 (dev-режим)
Собирается в live-ui/dist/ через npm run build (production)
Backend отдаёт старый UI из директории web/ (не Live UI v2)
Точки интеграции:

WebSocket: ws://localhost:8080/ws (захардкожен в live-ui/src/data/websocket.ts)
Layout: загружается из статического файла /example-layout.json
Event Model: типы дублируются в TypeScript (live-ui/src/data/types.ts)
1.2 Зависимости от backend
Текущие зависимости:

WebSocket API контракт:
WSRequest (runId, sourceId, channel, types, tags)
Event (v, runId, sourceId, channel, type, frameIndex, simTime, wallTimeMs, tags, payload)
Endpoint: /ws
Конфигурация:
WebSocket URL захардкожен: ws://localhost:8080/ws
Нет конфигурации через environment variables
Данные:
Layout загружается из статического файла
Нет API для загрузки layout из backend
Отсутствующие зависимости:

✅ Нет прямых импортов из backend кода
✅ Нет shared TypeScript/Go модулей
✅ Event Model типы дублируются (не shared)
✅ Нет зависимости от backend бинарника
1.3 Что UI знает о backend
UI знает:

WebSocket endpoint (/ws)
Структуру WSRequest и Event
Протокол подключения (JSON over WebSocket)
UI НЕ знает:

Внутреннюю структуру backend (EventBus, Buffer, Storage)
Go-специфичные детали
ClickHouse структуру
Backend конфигурацию
---

2. Целевая архитектура (TO-BE)
2.1 Live UI как standalone сервис
Целевое состояние:

Live UI запускается как отдельный контейнер в docker-compose
Собственный lifecycle (независимый от backend)
Конфигурация через environment variables
Production build (Vite build) отдаётся через nginx или простой HTTP сервер
Структура сервиса:

live-ui/
├── Dockerfile              # Multi-stage build (Node.js build + nginx serve)
├── docker-compose.yml      # Интеграция в общий compose (опционально)
├── nginx.conf             # Конфигурация nginx для production
└── .env.example           # Пример конфигурации
2.2 Минимальный контракт между backend и UI
WebSocket API контракт (неизменен):

Endpoint: /ws
Request: WSRequest (JSON)
Response: поток Event (JSON)
Протокол: JSON over WebSocket
Конфигурационный контракт:

VITE_WS_URL или REACT_APP_WS_URL (WebSocket URL)
VITE_LAYOUT_URL (опционально, URL для загрузки layout)
Сетевой контракт:

Backend доступен по имени сервиса: teltel:8080 (внутри Docker сети)
UI доступен на отдельном порту: 3000 (или настраиваемом)
2.3 Отсутствие прямых зависимостей
Запрещено:

❌ Прямые импорты из backend кода
❌ Shared TypeScript/Go модули
❌ Зависимость от backend бинарника
❌ Прямой доступ к ClickHouse из UI
Допустимо:

✅ WebSocket API контракт (явный, документированный)
✅ Environment variables для конфигурации
✅ HTTP API для загрузки layout (опционально, будущее)
---

3. Границы ответственности
3.1 Backend отвечает за
Генерация данных:

Приём событий через /api/ingest
Валидация Event Model
Маршрутизация через EventBus
Логгирование:

Структурированное логирование событий
Метрики и мониторинг
Streaming:

WebSocket endpoint /ws
Подписки на EventBus
Backpressure handling (drop_old для UI)
Run lifecycle:

Управление run'ами (start/end)
Метаданные run'ов
API для получения списка run'ов (/api/runs)
Storage (опционально):

Сохранение в ClickHouse
Analysis API (/api/analysis/*)
3.2 Live UI отвечает за
Визуализация:

Рендеринг графиков (Observable Plot, D3)
Layout rendering
Chart Engine
Интерактивность:

Hover & Tooltip
Time Cursor
Zoom & Pan
Live Control (Play/Pause)
Time Scrubbing
Анализ (UI-уровень):

Window Logic (frames/time/all)
Data Adapter (преобразование Event → DataPoint)
Синхронизация состояний между графиками
Синхронизация UI-состояний:

Shared State Engine
Синхронизация time_cursor
Синхронизация hover, zoom/pan
3.3 Что запрещено прокидывать через границу
Категорически запрещено:

❌ Backend внутренние структуры (EventBus, Buffer, Storage)
❌ Go-специфичные типы
❌ Прямой доступ к ClickHouse
❌ Backend конфигурация (env vars backend'а)
❌ Shared код между backend и UI
❌ Зависимости от backend бинарника
Допустимо через границу:

✅ WebSocket API контракт (явный, документированный)
✅ Event Model (JSON структура)
✅ Environment variables для UI конфигурации
✅ HTTP API для метаданных (run list, layout)
---

4. Docker / Compose стратегия
4.1 Структура docker-compose
Новая структура:

services:
  clickhouse:
    # ... существующий сервис

  teltel:
    # ... существующий сервис (backend)
    # УБРАТЬ: отдачу статических файлов из web/

  live-ui:
    build:
      context: ./live-ui
      dockerfile: Dockerfile
    container_name: teltel-live-ui
    ports:
      - "3000:80"  # или настраиваемый порт
    environment:
      - VITE_WS_URL=ws://teltel:8080/ws
      # Для production build VITE_ переменные инжектируются на этапе build
    depends_on:
      teltel:
        condition: service_healthy
    networks:
      - teltel-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/"]
      interval: 10s
      timeout: 5s
      retries: 3
4.2 Зависимости сервисов
Порядок запуска:

clickhouse (health check)
teltel (зависит от clickhouse, health check)
live-ui (зависит от teltel)
Сеть:

Все сервисы в одной Docker сети: teltel-network
Backend доступен как teltel:8080
UI доступен как live-ui:80 (внутри сети)
4.3 Переменные окружения
Backend (teltel):

TELTEL_HTTP_PORT=8080
TELTEL_CLICKHOUSE_URL=http://clickhouse:8123
(остальные без изменений)
Live UI:

VITE_WS_URL=ws://teltel:8080/ws (для build-time)
VITE_LAYOUT_URL=http://teltel:8080/api/layout (опционально, будущее)
Для production: переменные инжектируются на этапе build
Проблема VITE переменных:

Vite инжектирует VITE_* переменные на этапе build
Для runtime конфигурации нужен workaround (см. этап 2)
4.4 Порты и networking
Внешние порты:

8081 → teltel:8080 (backend)
3000 → live-ui:80 (UI)
8123 → clickhouse:8123 (ClickHouse)
Внутренние порты (Docker сеть):

teltel:8080 (backend)
live-ui:80 (UI)
clickhouse:8123 (ClickHouse)
CORS:

Backend должен разрешать CORS для http://localhost:3000 (dev)
В production (Docker) CORS не нужен (одна сеть)
---

5. Этапы миграции
Этап 1: Подготовка (Audit зависимостей)
Цель: Полностью понять текущие зависимости и точки интеграции

Входные условия:

Live UI v2 зафиксирован и стабилен
Документация архитектуры актуальна
Задачи:

Аудит всех зависимостей от backend
Документирование WebSocket API контракта
Проверка отсутствия shared кода
Анализ конфигурации (хардкод vs env vars)
Ожидаемый результат:

Документ с полным списком зависимостей
Явный WebSocket API контракт
Список точек интеграции
Риски:

Обнаружение скрытых зависимостей
Mitigation: Полный аудит кода, проверка импортов
---

Этап 2: Конфигурационная изоляция
Цель: Убрать хардкод WebSocket URL, добавить конфигурацию через env vars

Входные условия:

Этап 1 завершён
WebSocket API контракт документирован
Задачи:

Добавить поддержку VITE_WS_URL в websocket.ts
Fallback на ws://localhost:8080/ws для dev-режима
Для production: runtime конфигурация через window.__ENV__ или config.js
Обновить документацию по конфигурации
Проблема VITE переменных:

Vite инжектирует переменные на build-time
Для runtime нужен workaround:
Вариант A: config.js загружается перед React (runtime)
Вариант B: window.__ENV__ инжектируется через nginx template
Вариант C: API endpoint /api/config для получения конфигурации
Ожидаемый результат:

WebSocket URL настраивается через env vars
Dev-режим работает с fallback
Production готов к Docker
Риски:

Vite переменные только на build-time
Mitigation: Использовать runtime конфигурацию (config.js)
---

Этап 3: Контракт Data Layer ✅ ЗАВЕРШЁН
Цель: Зафиксировать и документировать WebSocket API контракт

Входные условия:

✅ Этап 2 завершён
✅ Конфигурация изолирована
Задачи:

✅ Создать документ WEBSOCKET_API_CONTRACT.md
✅ Описать структуру WSRequest и Event
✅ Описать протокол подключения
✅ Описать обработку ошибок
✅ Добавить примеры использования
Ожидаемый результат:

✅ Явный, документированный контракт
✅ Примеры для интеграции
✅ Версионирование контракта (v1)
Риски:

Несоответствие контракта реализации
Mitigation: Валидация контракта через тесты
---

Этап 4: Dockerization UI ✅ ЗАВЕРШЁН
Цель: Создать Dockerfile для Live UI и протестировать сборку

Входные условия:

✅ Этап 3 завершён
✅ Конфигурация работает через env vars
Задачи:

✅ Создать live-ui/Dockerfile (multi-stage: build + nginx)
✅ Создать live-ui/nginx.conf для production
✅ Создать live-ui/.dockerignore
✅ Создать live-ui/docker-entrypoint.sh для генерации config.js из env vars
✅ Протестировать сборку образа
✅ Протестировать запуск контейнера локально
Структура Dockerfile:

# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
Ожидаемый результат:

✅ Рабочий Dockerfile
✅ Production build работает в контейнере
✅ Конфигурация через env vars работает
✅ Runtime конфигурация через docker-entrypoint.sh работает
✅ Health check endpoint работает
✅ Nginx корректно отдает статические файлы

Реализовано:
- Multi-stage Dockerfile (node:20-alpine для build, nginx:alpine для serve)
- nginx.conf с настройками для SPA, gzip, security headers
- docker-entrypoint.sh для генерации config.js из environment variables
- .dockerignore для оптимизации build context
- Исправлены все TypeScript ошибки компиляции

Риски:

Проблемы с путями в production build
Mitigation: Тестирование на разных окружениях ✅ Протестировано
---

Этап 5: Compose-интеграция ✅ ЗАВЕРШЁН
Цель: Интегрировать Live UI в docker-compose.yml

Входные условия:

✅ Этап 4 завершён
✅ Dockerfile протестирован
Задачи:

✅ Добавить сервис live-ui в docker-compose.yml
✅ Настроить зависимости (depends_on)
✅ Настроить сеть (teltel-network)
✅ Настроить environment variables
✅ Протестировать полный стек (clickhouse + teltel + live-ui)
Ожидаемый результат:

✅ Live UI запускается через docker-compose up
✅ Все сервисы работают вместе
✅ WebSocket подключение работает (настроен внешний адрес для браузерных подключений)

Реализовано:
- Сервис live-ui добавлен в docker-compose.yml
- Настроены зависимости: live-ui зависит от teltel с condition: service_healthy
- Настроена сеть: все сервисы в teltel-network
- Настроены environment variables: VITE_WS_URL=ws://localhost:8081/ws (внешний адрес для браузера)
- Добавлен healthcheck для live-ui: GET /health
- Установлен wget в Dockerfile для healthcheck
- Обновлена документация DOCKER.md с информацией о live-ui сервисе
- Образ успешно собран и готов к использованию

Риски:

Проблемы с networking (CORS, DNS)
Mitigation: ✅ Проверка DNS resolution, CORS настройки (WebSocket URL настроен для браузерных подключений)
---

Этап 6: Проверка обратной совместимости
Цель: Убедиться, что существующие layout'ы и функциональность работают

Входные условия:

Этап 5 завершён
Полный стек работает
Задачи:

Протестировать все типы графиков
Протестировать все интерактивные функции
Протестировать загрузку layout'ов
Протестировать WebSocket переподключение
Сравнить поведение в Docker vs локальный запуск
Ожидаемый результат:

Все функции работают идентично
Нет регрессий
Документация обновлена
Риски:

Регрессии в функциональности
Mitigation: Полное тестирование, сравнение с baseline
---

Этап 7: Документация и user guide update
Цель: Обновить документацию для нового способа запуска

Входные условия:

Этап 6 завершён
Обратная совместимость проверена
Задачи:

Обновить README.md с инструкциями по Docker запуску
Обновить docs/USER_GUIDE.md с новым способом запуска
Обновить docs/DOCKER.md с информацией о Live UI сервисе
Создать live-ui/README.md с инструкциями по разработке и сборке
Документировать переменные окружения
Добавить примеры docker-compose конфигураций
Ожидаемый результат:

Полная документация по запуску через Docker
Инструкции для разработчиков
Инструкции для пользователей
Риски:

Неполная или устаревшая документация
Mitigation: Регулярный review документации, примеры использования

---

## 6. Риски и меры снижения

### 6.1 Coupling риски

**Риск:** Скрытые зависимости от backend кода или структуры

**Проявления:**
- Неявные предположения о структуре Event
- Зависимости от порядка полей в JSON
- Предположения о поведении WebSocket endpoint

**Меры снижения:**
- Явный WebSocket API контракт с версионированием
- Валидация Event Model на стороне UI
- Тесты на совместимость контракта
- Документирование всех предположений

---

### 6.2 Конфигурационные ошибки

**Риск:** Неправильная конфигурация приводит к нерабочему UI

**Проявления:**
- Неверный WebSocket URL
- Отсутствие обязательных переменных окружения
- Неправильные пути в production build

**Меры снижения:**
- Валидация конфигурации при старте UI
- Понятные сообщения об ошибках
- Fallback значения для dev-режима
- Примеры конфигурации (.env.example)
- Документация всех переменных окружения

---

### 6.3 Проблемы с networking

**Риск:** Проблемы с подключением между сервисами в Docker

**Проявления:**
- DNS resolution не работает (teltel:8080 недоступен)
- CORS ошибки в браузере
- WebSocket не подключается
- Таймауты при подключении

**Меры снижения:**
- Использование Docker DNS (имена сервисов)
- Health checks для всех сервисов
- Зависимости через depends_on с condition
- Логирование ошибок подключения
- Retry логика в WebSocket клиенте
- Документация troubleshooting

---

### 6.4 Проблемы с latency

**Риск:** Увеличение задержки из-за дополнительного сетевого хопа

**Проявления:**
- Задержка в отображении данных
- Медленная реакция на интерактивность
- Проблемы с real-time обновлениями

**Меры снижения:**
- Минимизация сетевых хопов (одна Docker сеть)
- Оптимизация WebSocket протокола
- Backpressure handling на backend (drop_old)
- Мониторинг latency метрик
- Профилирование производительности

---

### 6.5 Проблемы с dev-experience

**Риск:** Ухудшение опыта разработки после выноса в Docker

**Проявления:**
- Медленная итерация (пересборка образов)
- Сложность отладки
- Проблемы с hot-reload
- Неудобство локальной разработки

**Меры снижения:**
- Сохранение возможности локального запуска (npm run dev)
- Volume mounts для разработки (опционально)
- Отдельные docker-compose файлы для dev/prod
- Документация workflow для разработчиков
- Поддержка source maps в production build

---

### 6.6 Проблемы с версионированием

**Риск:** Несовместимость версий UI и backend

**Проявления:**
- Изменение Event Model ломает UI
- Изменение WebSocket протокола
- Несовместимость контрактов

**Меры снижения:**
- Версионирование WebSocket API контракта
- Обратная совместимость контрактов
- Явное документирование breaking changes
- Тесты на совместимость версий
- Semantic versioning для UI сервиса

---

### 6.7 Проблемы с мониторингом

**Риск:** Сложность мониторинга распределённой системы

**Проявления:**
- Непонятно, где происходит ошибка (UI или backend)
- Сложность отслеживания проблем
- Отсутствие метрик по UI сервису

**Меры снижения:**
- Логирование на всех уровнях
- Correlation IDs для трассировки запросов
- Health checks для UI сервиса
- Метрики подключений WebSocket
- Документация troubleshooting

---

## 7. Влияние на будущее развитие

### 7.1 Упрощение Stage 8 (Run Comparison)

**Текущая ситуация:**
- Stage 8 требует сравнения нескольких run'ов
- Необходима работа с историческими данными из ClickHouse
- Требуется гибридный режим (live + historical)

**После выноса UI:**
- ✅ Независимый lifecycle упрощает добавление новых фич
- ✅ Изолированная архитектура позволяет безопасно расширять Data Layer
- ✅ Отдельный сервис упрощает тестирование новых возможностей
- ✅ Возможность масштабирования UI независимо от backend

**Конкретные преимущества:**
- Data Layer можно расширить для работы с Analysis API без влияния на backend
- Новые типы графиков можно добавлять без изменения backend контрактов
- Гибридный режим (live + historical) проще реализовать в изолированном сервисе

---

### 7.2 Влияние на E2E-тесты

**Текущая ситуация:**
- E2E-тесты требуют запуска всего стека
- Сложность изоляции тестов UI от backend

**После выноса UI:**
- ✅ Возможность мокирования backend для UI тестов
- ✅ Изолированное тестирование UI сервиса
- ✅ Упрощение CI/CD pipeline (параллельный запуск тестов)
- ✅ Возможность использования test containers для backend

**Конкретные преимущества:**
- UI тесты могут использовать mock WebSocket сервер
- Backend тесты не требуют UI
- Параллельное выполнение тестов ускоряет CI/CD
- Легче тестировать edge cases (network failures, reconnection)

---

### 7.3 Влияние на релизную стратегию

**Текущая ситуация:**
- UI и backend связаны в одном релизе
- Изменения в UI требуют пересборки backend

**После выноса UI:**
- ✅ Независимые версии UI и backend
- ✅ Возможность релизить UI отдельно
- ✅ Semantic versioning для UI сервиса
- ✅ Откат UI без влияния на backend

**Конкретные преимущества:**
- UI может обновляться чаще, чем backend
- Backward compatibility проще поддерживать (версии контрактов)
- A/B тестирование UI версий
- Canary deployments для UI

---

### 7.4 Влияние на масштабирование

**Текущая ситуация:**
- UI и backend масштабируются вместе
- Невозможно масштабировать UI независимо

**После выноса UI:**
- ✅ Горизонтальное масштабирование UI сервиса
- ✅ Load balancing для UI (nginx, traefik)
- ✅ CDN для статических ресурсов
- ✅ Независимое масштабирование backend и UI

**Конкретные преимущества:**
- Множественные инстансы UI для высокой нагрузки
- Кэширование статических ресурсов на CDN
- Географическое распределение UI сервисов
- Оптимизация ресурсов (UI может использовать меньше CPU/memory)

---

### 7.5 Влияние на архитектурную эволюцию

**Текущая ситуация:**
- Изменения в UI могут требовать изменений в backend
- Сложность экспериментирования с новыми подходами

**После выноса UI:**
- ✅ Возможность экспериментировать с UI технологиями
- ✅ Легче пробовать новые подходы к визуализации
- ✅ Изоляция позволяет безопасно эволюционировать
- ✅ Возможность создания альтернативных UI (например, для мобильных устройств)

**Конкретные преимущества:**
- Эксперименты с новыми библиотеками визуализации
- A/B тестирование разных UI подходов
- Создание специализированных UI (mobile, embedded)
- Легче мигрировать на новые версии React/Vite

---

## 8. Definition of Done

Roadmap считается завершённым, если:

### 8.1 Архитектурные границы

- ✅ Ясно определены границы ответственности backend и UI
- ✅ Документирован минимальный контракт между сервисами
- ✅ Отсутствуют прямые зависимости (импорты, shared код)
- ✅ WebSocket API контракт явно документирован

### 8.2 Функциональность

- ✅ Live UI работает как standalone сервис в Docker
- ✅ Все существующие функции работают идентично
- ✅ Обратная совместимость сохранена
- ✅ Нет регрессий в функциональности

### 8.3 Конфигурация

- ✅ Конфигурация через environment variables
- ✅ Dev-режим работает локально
- ✅ Production работает в Docker
- ✅ Документация по конфигурации актуальна

### 8.4 Документация

- ✅ Roadmap документирован полностью
- ✅ User guide обновлён
- ✅ Docker документация обновлена
- ✅ WebSocket API контракт документирован
- ✅ Troubleshooting guide создан

### 8.5 Готовность к использованию

- ✅ docker-compose up запускает полный стек
- ✅ Все сервисы имеют health checks
- ✅ Логирование настроено
- ✅ Примеры конфигурации предоставлены

---

## 9. Итоговые выводы

### 9.1 Ключевые достижения

Выделение Live UI v2 в отдельный сервис обеспечивает:

1. **Архитектурную чистоту** — чёткие границы ответственности
2. **Независимость lifecycle** — UI и backend развиваются независимо
3. **Масштабируемость** — возможность независимого масштабирования
4. **Гибкость разработки** — упрощение добавления новых фич
5. **Улучшение dev-experience** — изолированное тестирование и разработка

### 9.2 Критические успехи

- ✅ Сохранение архитектурных границ
- ✅ Отсутствие нарушения обратной совместимости
- ✅ Минимальный контракт между сервисами
- ✅ Готовность к будущему развитию (Stage 8)

### 9.3 Следующие шаги

После завершения roadmap:

1. **Реализация этапов 1-7** — последовательное выполнение плана
2. **Мониторинг и оптимизация** — отслеживание производительности
3. **Расширение функциональности** — Stage 8 на базе новой архитектуры
4. **Улучшение документации** — на основе feedback пользователей

---

## 10. Ссылки и ресурсы

### Документация проекта

- [LIVE_UI_ARCHITECTURE_DESIGN.md](LIVE_UI_ARCHITECTURE_DESIGN.md) — архитектурный дизайн Live UI
- [docs/LIVE_UI_V2_FREEZE.md](docs/LIVE_UI_V2_FREEZE.md) — заморозка Live UI v2
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — руководство пользователя
- [docs/DOCKER.md](docs/DOCKER.md) — Docker документация
- [live-ui/IMPLEMENTATION_STATUS.md](live-ui/IMPLEMENTATION_STATUS.md) — статус реализации

### Контракты

- [WebSocket API контракт](docs/WEBSOCKET_API_CONTRACT.md) ✅
- Event Model контракт (docs/03-event-model.md)
- Layout Contract (live-ui/src/schemas/layout.schema.json)
- ChartSpec Contract (live-ui/src/schemas/chartSpec.schema.json)

### Внешние ресурсы

- [Vite Documentation](https://vitejs.dev/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Roadmap создан:** 2024  
**Статус:** Готов к реализации  
**Версия:** 1.0