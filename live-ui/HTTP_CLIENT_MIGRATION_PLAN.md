# План миграции Live UI HTTP клиента на относительные пути

## Обзор

Этот документ описывает изменения, выполненные в рамках Этапа 4 roadmap по внедрению nginx proxy и переходу на относительные пути. Цель — устранить зависимость от абсолютных URL и обеспечить работу через nginx proxy.

## Выполненные изменения

### 1. Упрощение `src/utils/config.ts`

**Было:**
- `getWebSocketUrl()` использовала сложную логику с приоритетами:
  1. `window.__ENV__.VITE_WS_URL` (runtime)
  2. `import.meta.env.VITE_WS_URL` (build-time)
  3. `ws://localhost:8080/ws` (fallback)
- `getApiBaseUrl()` извлекала базовый URL из WebSocket URL через преобразование `ws://` → `http://`

**Стало:**
- `getWebSocketUrl()` возвращает `/ws` (относительный путь)
- `getApiBaseUrl()` возвращает `""` (пустую строку для относительных путей)
- Убрана вся логика с runtime/build-time конфигурацией и fallback

**Изменения:**
```typescript
// Было:
export function getWebSocketUrl(): string {
  if (typeof window !== 'undefined' && window.__ENV__) {
    if (window.__ENV__.VITE_WS_URL) {
      return window.__ENV__.VITE_WS_URL;
    }
  }
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  return 'ws://localhost:8080/ws';
}

export function getApiBaseUrl(): string {
  const wsUrl = getWebSocketUrl();
  const httpUrl = wsUrl.replace(/^ws/, 'http');
  return httpUrl.replace(/\/ws$/, '');
}

// Стало:
export function getWebSocketUrl(): string {
  return '/ws';
}

export function getApiBaseUrl(): string {
  return '';
}
```

**Файл:** `src/utils/config.ts`

### 2. Миграция `src/data/analysis.ts`

**Было:**
- `AnalysisClient` использовал `baseUrl` из `getApiBaseUrl()`
- Все URL формировались как `${this.baseUrl}/api/analysis/*`
- Конструктор принимал опциональный `baseUrl` параметр

**Стало:**
- Убрана зависимость от `getApiBaseUrl()`
- Все URL используют относительные пути `/api/analysis/*`
- Конструктор упрощён (убраны параметры)

**Изменения:**
```typescript
// Было:
import { getApiBaseUrl } from '../utils/config';

export class AnalysisClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  async getRuns(params?: GetRunsParams): Promise<RunMetadata[]> {
    const url = `${this.baseUrl}/api/analysis/runs?...`;
    // ...
  }
}

// Стало:
export class AnalysisClient {
  constructor() {
    // Больше не нужен baseUrl, используем относительные пути
  }

  async getRuns(params?: GetRunsParams): Promise<RunMetadata[]> {
    const url = `/api/analysis/runs?...`;
    // ...
  }
}
```

**Изменённые методы:**
- `getRuns()`: `${this.baseUrl}/api/analysis/runs` → `/api/analysis/runs`
- `getRun()`: `${this.baseUrl}/api/analysis/run/{runId}` → `/api/analysis/run/{runId}`
- `getSeries()`: `${this.baseUrl}/api/analysis/series` → `/api/analysis/series`
- `compareRuns()`: `${this.baseUrl}/api/analysis/compare` → `/api/analysis/compare`

**Файл:** `src/data/analysis.ts`

### 3. Проверка других использований fetch

**Проверенные файлы:**
- `src/App.tsx`: использует `/example-layout.json` (уже относительный путь) ✅
- `src/utils/loader.ts`: использует `fetch(path)` где `path` передаётся как параметр (относительный путь) ✅

**Результат:** Изменения не требуются, все уже используют относительные пути.

## Breaking Changes

### 1. Удалена поддержка runtime конфигурации WebSocket URL

**Было:**
- Можно было задать `VITE_WS_URL` через `window.__ENV__` или build-time переменные
- Поддерживался fallback на `ws://localhost:8080/ws`

**Стало:**
- Всегда используется `/ws` (относительный путь)
- WebSocket URL больше не настраивается через переменные окружения

**Миграция:**
- Убрать `VITE_WS_URL` из `docker-compose.yml` (будет выполнено в Этапе 3)
- Убрать генерацию `config.js` в `docker-entrypoint.sh` (будет выполнено в Этапе 5)

### 2. Изменён конструктор `AnalysisClient`

**Было:**
```typescript
const client = new AnalysisClient('http://custom-url');
```

**Стало:**
```typescript
const client = new AnalysisClient(); // Без параметров
```

**Миграция:**
- Все использования `new AnalysisClient()` уже без параметров (через `getAnalysisClient()` singleton)
- Если где-то использовался `new AnalysisClient(customUrl)`, нужно убрать параметр

## Зависимости

### Этап 4 зависит от:
- ✅ **Этап 1 (Аудит)**: Выявлены все места использования абсолютных URL
- ✅ **Этап 2 (Проектирование nginx)**: Понятна структура API endpoints для проксирования

### Этап 4 блокирует:
- **Этап 5 (Миграция WebSocket)**: Использует упрощённый `getWebSocketUrl()`
- **Этап 6 (Dev/prod parity)**: Нужна проверка работы с относительными путями

## Тестирование

### Что нужно протестировать:

1. **HTTP API запросы:**
   - `GET /api/analysis/runs` — список run'ов
   - `GET /api/analysis/run/{runId}` — метаданные run'а
   - `GET /api/analysis/series` — временной ряд
   - `GET /api/analysis/compare` — сравнение run'ов

2. **Относительные пути:**
   - Все запросы должны идти на относительные URL (начинаются с `/`)
   - Не должно быть абсолютных URL типа `http://localhost:8081/...`

3. **Совместимость:**
   - Проверить работу в dev-режиме (Vite dev server)
   - Проверить работу в production (nginx proxy)

### Ожидаемое поведение:

**До nginx proxy (текущее состояние):**
- ❌ Запросы к `/api/analysis/*` будут падать с 404 (nginx не проксирует)
- ⚠️ Это ожидаемо, так как nginx proxy будет настроен в следующих этапах

**После настройки nginx proxy (Этап 3):**
- ✅ Запросы к `/api/analysis/*` будут проксироваться к `http://teltel:8080/api/analysis/*`
- ✅ Все запросы будут работать через единый origin

## Риски и меры снижения

### Риск 1: Регрессии в функциональности

**Описание:** Изменение URL может сломать существующие запросы.

**Вероятность:** Низкая (изменения минимальны)

**Влияние:** Высокое

**Меры снижения:**
- ✅ Все изменения протестированы на уровне кода
- ⚠️ Требуется интеграционное тестирование после настройки nginx proxy
- ⚠️ Проверить работу в dev-режиме с Vite proxy (Этап 6)

### Риск 2: Потеря обратной совместимости

**Описание:** Убрана поддержка runtime конфигурации WebSocket URL.

**Вероятность:** Высокая (изменение преднамеренное)

**Влияние:** Низкое (только для разработчиков)

**Меры снижения:**
- ✅ Документировано в Breaking Changes
- ⚠️ Обновить документацию после завершения всех этапов
- ⚠️ Уведомить команду об изменениях

### Риск 3: Скрытые зависимости от абсолютных URL

**Описание:** Могут остаться неучтённые места с абсолютными URL.

**Вероятность:** Низкая (полный аудит на Этапе 1)

**Влияние:** Среднее

**Меры снижения:**
- ✅ Проверены все файлы с использованием `getApiBaseUrl()` и `getWebSocketUrl()`
- ✅ Проверены все использования `fetch` с абсолютными URL
- ⚠️ Рекомендуется дополнительная проверка после интеграции nginx proxy

## Следующие шаги

1. **Этап 5**: Миграция WebSocket на относительный URL `/ws`
2. **Этап 6**: Настройка Vite proxy для dev-режима и проверка dev/prod parity
3. **Этап 7**: Обновление документации

## Статус выполнения

- ✅ Упрощение `src/utils/config.ts`
- ✅ Миграция `src/data/analysis.ts`
- ✅ Проверка других использований fetch
- ✅ Создание документации

**Статус:** ✅ Завершён

**Дата выполнения:** 2024
