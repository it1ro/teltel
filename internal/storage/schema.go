package storage

import (
	"context"
	_ "embed"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed schema.sql
var embeddedSchemaSQL string

// SchemaManager управляет ClickHouse схемой.
type SchemaManager struct {
	client Client
}

// NewSchemaManager создаёт новый SchemaManager.
func NewSchemaManager(client Client) *SchemaManager {
	return &SchemaManager{
		client: client,
	}
}

// InitSchema создаёт таблицы в ClickHouse согласно schema.sql.
func (sm *SchemaManager) InitSchema(ctx context.Context) error {
	// Читаем schema.sql из файла
	schemaSQL, err := sm.readSchemaSQL()
	if err != nil {
		return fmt.Errorf("failed to read schema: %w", err)
	}

	// Разбиваем на отдельные запросы (разделитель - точка с запятой)
	queries := sm.splitQueries(schemaSQL)

	// Выполняем каждый запрос отдельно
	for _, query := range queries {
		query = strings.TrimSpace(query)
		if query == "" {
			continue
		}
		if err := sm.client.Exec(ctx, query); err != nil {
			return fmt.Errorf("failed to execute schema query: %w", err)
		}
	}

	return nil
}

// readSchemaSQL читает schema.sql из файла или использует embedded версию.
func (sm *SchemaManager) readSchemaSQL() (string, error) {
	// Сначала пытаемся использовать embedded версию (для production/Docker)
	if embeddedSchemaSQL != "" {
		return embeddedSchemaSQL, nil
	}

	// Fallback: получаем путь к schema.sql относительно этого файла (для dev)
	_, filename, _, _ := runtime.Caller(0)
	schemaPath := filepath.Join(filepath.Dir(filename), "schema.sql")

	file, err := os.Open(schemaPath)
	if err != nil {
		return "", fmt.Errorf("failed to open schema.sql: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("failed to read schema.sql: %w", err)
	}

	return string(data), nil
}

// splitQueries разбивает SQL на отдельные запросы.
func (sm *SchemaManager) splitQueries(sql string) []string {
	// Простое разбиение по точке с запятой
	// В реальности может потребоваться более сложная логика
	queries := strings.Split(sql, ";")
	result := make([]string, 0, len(queries))
	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q != "" {
			result = append(result, q)
		}
	}
	return result
}
