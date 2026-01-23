# Аудит HTTP и WebSocket обращений в Live UI

**Дата:** 2024  
**Этап:** 1 из roadmap "nginx proxy и переход Live UI v2 на fetch API"  
**Статус:** ✅ Завершён

## Цель аудита

Полная инвентаризация всех мест, где используются абсолютные URL для API и WebSocket подключений, с целью последующей миграции на относительные пути через nginx proxy.

## Методология

1. Поиск всех использований функций `getWebSocketUrl()` и `getApiBaseUrl()`
2. Поиск всех прямых обращений к `localhost:8080/8081`
3. Поиск всех использований `fetch` с абсолютными URL
4. Поиск всех созданий WebSocket с абсолютными URL
5. Анализ конфигурационных файлов (Docker, nginx, Vite)

## Результаты аудита

### 1. Функции конфигурации URL

#### Файл: `src/utils/config.ts`

**Функции:**
- `getWebSocketUrl()` — возвращает абсолютный WebSocket URL
  - Приоритет 1: `window.__ENV__.VITE_WS_URL` (runtime)
  - Приоритет 2: `import.meta.env.VITE_WS_URL` (build-time)
  - Приоритет 3: `ws://localhost:8080/ws` (fallback)
  
- `getApiBaseUrl()` — извлекает базовый HTTP URL из WebSocket URL
  - Преобразует `ws://host:port/ws` → `http://host:port`
  - Используется для формирования абсолютных URL API запросов

**Использование:**
- Вызывается в `src/data/websocket.ts` (строка 7, 25)
- Вызывается в `src/data/layer.ts` (строка 13, 55)
- Вызывается в `src/data/analysis.ts` (строка 6, 114)

**Требует изменений:** ✅ Да
- Упростить `getWebSocketUrl()`: возвращать `/ws` (относительный путь)
- Упростить `getApiBaseUrl()`: возвращать `""` (пустую строку для относительных путей)
- Убрать логику преобразования `ws://` → `http://`
- Убрать fallback на `ws://localhost:8080/ws`

---

### 2. HTTP API клиент

#### Файл: `src/data/analysis.ts`

**Класс:** `AnalysisClient`

**Использование абсолютных URL:**
- Строка 114: `this.baseUrl = baseUrl || getApiBaseUrl()` — получает абсолютный базовый URL
- Строка 132: `${this.baseUrl}/api/analysis/runs` — формирует абсолютный URL
- Строка 154: `${this.baseUrl}/api/analysis/run/${runId}` — формирует абсолютный URL
- Строка 185: `${this.baseUrl}/api/analysis/series` — формирует абсолютный URL
- Строка 213: `${this.baseUrl}/api/analysis/compare` — формирует абсолютный URL

**Использует `fetch` API:** ✅ Да (строки 137, 157, 188, 216)

**Требует изменений:** ✅ Да
- Убрать зависимость от `getApiBaseUrl()`
- Изменить формирование URL: `${this.baseUrl}/api/...` → `/api/...`
- Убрать параметр `baseUrl` из конструктора (или сделать опциональным для обратной совместимости)

---

### 3. WebSocket клиент

#### Файл: `src/data/websocket.ts`

**Класс:** `WSClient`

**Использование абсолютных URL:**
- Строка 7: `import { getWebSocketUrl } from '../utils/config'`
- Строка 25: `url: getWebSocketUrl()` — в DEFAULT_OPTIONS
- Строка 77: `new WebSocket(this.options.url)` — создание WebSocket с абсолютным URL

**Требует изменений:** ✅ Да
- Изменить `getWebSocketUrl()` для возврата относительного пути `/ws`
- Убедиться, что относительный путь работает с WebSocket (может потребоваться преобразование через `window.location`)

**Примечание:** WebSocket API в браузере поддерживает относительные пути, но они должны быть преобразованы в абсолютные. Браузер автоматически использует текущий origin (`window.location.origin`), но протокол должен быть `ws://` или `wss://`.

---

### 4. Data Layer

#### Файл: `src/data/layer.ts`

**Класс:** `DataLayer`

**Использование абсолютных URL:**
- Строка 13: `import { getWebSocketUrl } from '../utils/config'`
- Строка 55: `url: getWebSocketUrl()` — передача в WSClient

**Требует изменений:** ✅ Да (косвенно)
- Изменения в `getWebSocketUrl()` автоматически применятся здесь
- Проверить, что передача относительного пути работает корректно

---

### 5. Загрузка статических ресурсов

#### Файл: `src/App.tsx`

**Использование URL:**
- Строка 28: `fetch('/example-layout.json')` — ✅ **Уже относительный путь, не требует изменений**

#### Файл: `src/utils/loader.ts`

**Использование URL:**
- Строка 54: `fetch(path)` — ✅ **Использует переданный путь, не требует изменений**

**Вывод:** Статические ресурсы уже используют относительные пути корректно.

---

### 6. Конфигурационные файлы

#### Файл: `docker-entrypoint.sh`

**Назначение:** Генерирует `config.js` с runtime конфигурацией из environment variables

**Использование абсолютных URL:**
- Строка 22-23: Генерирует `window.__ENV__.VITE_WS_URL = '${VITE_WS_URL}'` (абсолютный URL)
- Строка 27-28: Генерирует `window.__ENV__.VITE_LAYOUT_URL = '${VITE_LAYOUT_URL}'` (абсолютный URL)

**Требует изменений:** ✅ Да
- Убрать генерацию `config.js` (больше не нужен для относительных путей)
- Упростить или удалить `docker-entrypoint.sh`

---

#### Файл: `Dockerfile`

**Использование абсолютных URL:**
- Строка 17-18: `ARG VITE_WS_URL` и `ARG VITE_LAYOUT_URL` (build-time переменные)
- Строка 20-21: `ENV VITE_WS_URL=${VITE_WS_URL}` и `ENV VITE_LAYOUT_URL=${VITE_LAYOUT_URL}`
- Строка 43-44: Runtime переменные (для `docker-entrypoint.sh`)

**Требует изменений:** ✅ Да
- Убрать build-time переменные `VITE_WS_URL` и `VITE_LAYOUT_URL` (не нужны для относительных путей)
- Убрать runtime переменные (не нужны для `docker-entrypoint.sh`)

---

#### Файл: `docker-compose.yml`

**Использование абсолютных URL:**
- Строка 55: `VITE_WS_URL=ws://localhost:8081/ws` — environment variable для Live UI

**Требует изменений:** ✅ Да
- Убрать `VITE_WS_URL` из environment секции `live-ui`
- Убрать внешний порт `8081:8080` у сервиса `teltel` (оставить только внутренний доступ)

---

#### Файл: `public/config.js`

**Назначение:** Пример runtime конфигурации (закомментированный)

**Использование абсолютных URL:**
- Строка 16: `// window.__ENV__.VITE_WS_URL = 'ws://localhost:8080/ws';` (закомментировано)
- Строка 20: `// window.__ENV__.VITE_LAYOUT_URL = 'http://localhost:8080/api/layout';` (закомментировано)

**Требует изменений:** ⚠️ Опционально
- Можно оставить как есть (закомментировано)
- Или удалить, если больше не используется

---

#### Файл: `vite.config.ts`

**Текущее состояние:**
- Нет proxy конфигурации для dev-режима

**Требует изменений:** ✅ Да (на Этапе 6)
- Добавить proxy для `/api/*` → `http://localhost:8080/api/*`
- Добавить proxy для `/ws` → `ws://localhost:8080/ws`

---

## Матрица зависимостей

### Компоненты, использующие WebSocket URL

```
src/data/layer.ts
  └─> getWebSocketUrl() (src/utils/config.ts)
      └─> WSClient (src/data/websocket.ts)
          └─> new WebSocket(url)
```

### Компоненты, использующие HTTP API URL

```
src/data/layer.ts
  └─> AnalysisClient (src/data/analysis.ts)
      └─> getApiBaseUrl() (src/utils/config.ts)
          └─> getWebSocketUrl() (src/utils/config.ts)
              └─> fetch(url) с абсолютными URL
```

### Конфигурационная цепочка

```
docker-compose.yml
  └─> VITE_WS_URL=ws://localhost:8081/ws
      └─> Dockerfile (build-time или runtime)
          └─> docker-entrypoint.sh
              └─> config.js (window.__ENV__.VITE_WS_URL)
                  └─> getWebSocketUrl() (src/utils/config.ts)
                      └─> WSClient / AnalysisClient
```

---

## Список файлов для изменения

### Критические изменения (обязательно)

1. **`src/utils/config.ts`**
   - Упростить `getWebSocketUrl()`: возвращать `/ws`
   - Упростить `getApiBaseUrl()`: возвращать `""`
   - Убрать логику преобразования и fallback

2. **`src/data/analysis.ts`**
   - Изменить формирование URL: убрать `this.baseUrl`, использовать относительные пути
   - Убрать зависимость от `getApiBaseUrl()`

3. **`src/data/websocket.ts`**
   - Проверить работу с относительным путём `/ws`
   - При необходимости добавить преобразование через `window.location`

4. **`docker-compose.yml`**
   - Убрать `VITE_WS_URL` из environment секции `live-ui`
   - Убрать внешний порт `8081:8080` у сервиса `teltel`

5. **`Dockerfile`**
   - Убрать build-time переменные `VITE_WS_URL` и `VITE_LAYOUT_URL`
   - Убрать runtime переменные (если не используются)

6. **`docker-entrypoint.sh`**
   - Упростить или удалить (больше не нужен для генерации `config.js`)

7. **`nginx.conf`** (на Этапе 2)
   - Добавить proxy для `/api/*` → `http://teltel:8080/api/*`
   - Добавить proxy для `/ws` → `ws://teltel:8080/ws`

8. **`vite.config.ts`** (на Этапе 6)
   - Добавить proxy для dev-режима

### Опциональные изменения

9. **`public/config.js`**
   - Можно удалить или оставить как есть (закомментировано)

---

## Статистика

- **Всего файлов с абсолютными URL:** 8
- **Критических файлов для изменения:** 7
- **Опциональных файлов:** 1
- **Файлов, уже использующих относительные пути:** 2 (`src/App.tsx`, `src/utils/loader.ts`)

---

## Риски и замечания

### Риск 1: WebSocket с относительными путями

**Описание:** WebSocket API в браузере может требовать абсолютный URL для подключения.

**Митигация:** 
- Использовать преобразование: `const wsUrl = url.startsWith('/') ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${url}` : url`
- Или проверить, что браузер автоматически преобразует относительный путь

### Риск 2: Скрытые hardcoded URL

**Описание:** Абсолютные URL могут быть в тестах или других местах.

**Митигация:**
- Проведён полный grep по паттернам `localhost:808`, `http://`, `ws://`
- Найдены только в документации и конфигурационных файлах (не в коде)

### Риск 3: Обратная совместимость

**Описание:** Изменения могут сломать существующие конфигурации.

**Митигация:**
- Добавить проверку: если URL уже абсолютный (начинается с `ws://` или `wss://`), использовать как есть
- Это обеспечит обратную совместимость в переходный период

---

## Следующие шаги

1. ✅ **Этап 1: Аудит** — завершён
2. ⏭️ **Этап 2: Проектирование nginx proxy конфигурации**
3. ⏭️ **Этап 3: План Docker-интеграции nginx**
4. ⏭️ **Этап 4: План миграции Live UI HTTP клиента на относительные пути**
5. ⏭️ **Этап 5: План миграции WebSocket на относительный URL**
6. ⏭️ **Этап 6: План проверки dev/prod parity**
7. ⏭️ **Этап 7: Документация и фиксация решения**

---

## Приложение: Полный список найденных использований

### Использования `getWebSocketUrl()` и `getApiBaseUrl()`

```
live-ui/src/utils/config.ts:30,74,89,91
live-ui/src/data/websocket.ts:7,25
live-ui/src/data/layer.ts:13,55
live-ui/src/data/analysis.ts:6,114
```

### Прямые обращения к `localhost:8080/8081`

```
live-ui/src/utils/config.ts:28,44
live-ui/public/config.js:16,20 (закомментировано)
live-ui/README.md:388,401,451,452,457,460,495,496,532,560,584,592
live-ui/docker-compose.yml:55
```

### Использования `fetch` с абсолютными URL

```
live-ui/src/data/analysis.ts:137,157,188,216 (через this.baseUrl)
live-ui/src/App.tsx:28 (относительный путь ✅)
live-ui/src/utils/loader.ts:54 (относительный путь ✅)
```

### Создания WebSocket

```
live-ui/src/data/websocket.ts:77 (new WebSocket(this.options.url))
```

---

**Статус:** ✅ Аудит завершён, готов к переходу на Этап 2
