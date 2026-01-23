# Changelog

Все значимые изменения в проекте teltel документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и этот проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

---

## [Unreleased]

### Удалено

- **Legacy UI v1 (web/)** — удалён встроенный в backend пользовательский интерфейс
  - Удалена директория `web/` с файлами `index.html`, `app.js`, `analysis.html`, `analysis.js`
  - Удалён код обслуживания статических файлов из backend
  - Удалена функция `findWebDir()` из `cmd/teltel/main.go`
  - Backend больше не отдаёт статические HTML/JS файлы
  - **Миграция:** Все функции Legacy UI доступны в Live UI v2 на http://localhost:3000
  - Подробнее: [docs/UI_MIGRATION.md](docs/UI_MIGRATION.md)

### Изменено

- **Backend** — теперь предоставляет только API и WebSocket endpoints
  - Backend больше не обслуживает статические файлы
  - Удалено логирование "Web UI: http://localhost:%d"
  - Обновлено логирование: "API endpoint: http://localhost:%d/api"
  - Порт 8081 используется только для API, не для UI

- **Docker** — обновлён Dockerfile
  - Удалена строка `COPY --from=builder /build/web /app/web`
  - Docker образ backend не содержит директорию `web/`

- **Документация** — обновлена для отражения новой архитектуры
  - Обновлены: `docs/API.md`, `docs/USER_GUIDE.md`, `README.md`, `DOCKER.md`
  - Удалены все упоминания Legacy UI
  - Добавлены явные замечания о том, что Live UI v2 является единственным UI
  - Создан документ миграции: `docs/UI_MIGRATION.md`

- **Скрипты валидации** — обновлены для работы с Live UI v2
  - Обновлён `scripts/validate.sh`: удалены проверки legacy UI
  - Добавлена проверка Live UI v2 на `http://localhost:3000`
  - Обновлён `scripts/validate_cursor_workflow.sh`

- **Makefile** — обновлены сообщения
  - Изменено сообщение при запуске: указывает на Live UI v2 на порту 3000

### Добавлено

- **Live UI v2** — зафиксирован как единственный пользовательский интерфейс
  - Доступен на http://localhost:3000 (отдельный Docker сервис)
  - Все функции Legacy UI реализованы в Live UI v2
  - Декларативный Layout (JSON Schema v1.0)
  - Shared State Engine
  - Chart Engine (Observable Plot)
  - Event Timeline (D3)

---

## [Предыдущие версии]

История изменений до удаления Legacy UI доступна в git истории.
