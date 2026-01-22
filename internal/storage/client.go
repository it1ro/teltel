package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// Client представляет интерфейс для работы с ClickHouse.
type Client interface {
	// Exec выполняет SQL запрос (CREATE TABLE, INSERT, etc.)
	Exec(ctx context.Context, query string) error

	// InsertBatch вставляет батч событий в формате JSONEachRow
	InsertBatch(ctx context.Context, table string, data []byte) error

	// Query выполняет SELECT запрос и возвращает результаты в формате JSON.
	// Возвращает raw JSON (JSONEachRow формат) без парсинга.
	Query(ctx context.Context, query string) ([]byte, error)
}

// HTTPClient реализует Client через HTTP API ClickHouse.
type HTTPClient struct {
	baseURL string
	client  *http.Client
}

// NewHTTPClient создаёт новый HTTP клиент для ClickHouse.
func NewHTTPClient(baseURL string) *HTTPClient {
	return &HTTPClient{
		baseURL: baseURL,
		client:  &http.Client{},
	}
}

// Exec выполняет SQL запрос через HTTP API.
func (c *HTTPClient) Exec(ctx context.Context, query string) error {
	// ClickHouse HTTP API: POST /?query=...
	u, err := url.Parse(c.baseURL)
	if err != nil {
		return fmt.Errorf("invalid base URL: %w", err)
	}

	u.RawQuery = url.Values{
		"query": []string{query},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, "POST", u.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("clickhouse error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// InsertBatch вставляет батч данных в формате JSONEachRow.
func (c *HTTPClient) InsertBatch(ctx context.Context, table string, data []byte) error {
	// ClickHouse HTTP API: POST /?query=INSERT INTO table FORMAT JSONEachRow
	u, err := url.Parse(c.baseURL)
	if err != nil {
		return fmt.Errorf("invalid base URL: %w", err)
	}

	query := fmt.Sprintf("INSERT INTO %s FORMAT JSONEachRow", table)
	u.RawQuery = url.Values{
		"query": []string{query},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, "POST", u.String(), strings.NewReader(string(data)))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-ndjson")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("clickhouse error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// Query выполняет SELECT запрос и возвращает результаты в формате JSON.
// Использует FORMAT JSONEachRow для получения результатов.
func (c *HTTPClient) Query(ctx context.Context, query string) ([]byte, error) {
	// Добавляем FORMAT JSONEachRow к запросу, если его нет
	queryWithFormat := query
	if !strings.Contains(strings.ToUpper(query), "FORMAT") {
		// Убираем точку с запятой в конце, если есть
		queryWithFormat = strings.TrimSuffix(strings.TrimSpace(query), ";")
		queryWithFormat += " FORMAT JSONEachRow"
	}

	// ClickHouse HTTP API: POST /?query=SELECT ... FORMAT JSONEachRow
	u, err := url.Parse(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}

	u.RawQuery = url.Values{
		"query": []string{queryWithFormat},
	}.Encode()

	req, err := http.NewRequestWithContext(ctx, "POST", u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("clickhouse error (status %d): %s", resp.StatusCode, string(body))
	}

	// Читаем raw JSON ответ
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return body, nil
}
