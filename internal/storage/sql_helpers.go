package storage

import "fmt"

// SQLHelpers содержит готовые SQL запросы для анализа телеметрии.
// Эти запросы можно использовать напрямую в ClickHouse или адаптировать для конкретных случаев.

// GetSeriesQuery возвращает SQL запрос для извлечения временного ряда.
// Параметры:
//   - runID: идентификатор run'а
//   - eventType: тип события (например, "body.state")
//   - sourceID: источник события (например, "drive-engine")
//   - jsonPath: путь к значению в payload (например, "pos.x")
func GetSeriesQuery(runID, eventType, sourceID, jsonPath string) string {
	return fmt.Sprintf(`
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, '%s') AS value
FROM telemetry_events
WHERE run_id = '%s'
  AND type = '%s'
  AND source_id = '%s'
ORDER BY frame_index;
`, jsonPath, runID, eventType, sourceID)
}

// GetMultipleSeriesQuery возвращает SQL запрос для извлечения нескольких временных рядов.
func GetMultipleSeriesQuery(runID, eventType, sourceID string, jsonPaths []string) string {
	selects := make([]string, 0, len(jsonPaths)+2)
	selects = append(selects, "frame_index", "sim_time")
	
	for _, path := range jsonPaths {
		selects = append(selects, fmt.Sprintf("JSONExtractFloat(payload, '%s') AS %s", path, sanitizeAlias(path)))
	}

	return fmt.Sprintf(`
SELECT
  %s
FROM telemetry_events
WHERE run_id = '%s'
  AND type = '%s'
  AND source_id = '%s'
ORDER BY frame_index;
`, joinStrings(selects, ", "), runID, eventType, sourceID)
}

// GetOutliersQuery возвращает SQL запрос для поиска выбросов.
func GetOutliersQuery(runID, eventType, jsonPath string, minValue, maxValue float64) string {
	return fmt.Sprintf(`
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, '%s') AS value
FROM telemetry_events
WHERE run_id = '%s'
  AND type = '%s'
  AND (
    JSONExtractFloat(payload, '%s') > %f
    OR JSONExtractFloat(payload, '%s') < %f
  )
ORDER BY frame_index;
`, jsonPath, runID, eventType, jsonPath, maxValue, jsonPath, minValue)
}

// GetSpikesQuery возвращает SQL запрос для поиска резких изменений между кадрами.
func GetSpikesQuery(runID, eventType, jsonPath string, threshold float64) string {
	return fmt.Sprintf(`
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, '%s') AS value,
    lagInFrame(JSONExtractFloat(payload, '%s')) OVER (
      PARTITION BY run_id ORDER BY frame_index
    ) AS prev_value
  FROM telemetry_events
  WHERE run_id = '%s'
    AND type = '%s'
)
SELECT
  frame_index,
  value,
  prev_value,
  abs(value - prev_value) AS delta
FROM series
WHERE abs(value - prev_value) > %f
ORDER BY frame_index;
`, jsonPath, jsonPath, runID, eventType, threshold)
}

// GetNaNQuery возвращает SQL запрос для поиска некорректных числовых значений.
func GetNaNQuery(runID, eventType, jsonPath string) string {
	return fmt.Sprintf(`
SELECT
  frame_index,
  sim_time,
  type,
  payload
FROM telemetry_events
WHERE run_id = '%s'
  AND type = '%s'
  AND (
    isNaN(JSONExtractFloat(payload, '%s'))
    OR isInfinite(JSONExtractFloat(payload, '%s'))
  )
ORDER BY frame_index;
`, runID, eventType, jsonPath, jsonPath)
}

// GetCompareRunsQuery возвращает SQL запрос для сравнения двух run'ов.
func GetCompareRunsQuery(runID1, runID2, eventType, sourceID, jsonPath string) string {
	return fmt.Sprintf(`
SELECT
  r1.frame_index,
  r1.sim_time AS sim_time_1,
  r2.sim_time AS sim_time_2,
  JSONExtractFloat(r1.payload, '%s') AS value_1,
  JSONExtractFloat(r2.payload, '%s') AS value_2,
  JSONExtractFloat(r2.payload, '%s') - JSONExtractFloat(r1.payload, '%s') AS diff
FROM telemetry_events AS r1
INNER JOIN telemetry_events AS r2
  ON r1.frame_index = r2.frame_index
WHERE r1.run_id = '%s'
  AND r2.run_id = '%s'
  AND r1.type = '%s'
  AND r2.type = '%s'
  AND r1.source_id = '%s'
  AND r2.source_id = '%s'
ORDER BY r1.frame_index;
`, jsonPath, jsonPath, jsonPath, jsonPath, runID1, runID2, eventType, eventType, sourceID, sourceID)
}

// GetRunStatsQuery возвращает SQL запрос для статистики по run'ам.
func GetRunStatsQuery() string {
	return `
SELECT
  run_id,
  count() AS total_events,
  min(frame_index) AS min_frame,
  max(frame_index) AS max_frame,
  max(frame_index) - min(frame_index) AS frame_range,
  min(sim_time) AS min_sim_time,
  max(sim_time) AS max_sim_time,
  max(sim_time) - min(sim_time) AS sim_duration
FROM telemetry_events
GROUP BY run_id
ORDER BY run_id;
`
}

// GetFrameAggregatesQuery возвращает SQL запрос для агрегации событий по кадрам.
func GetFrameAggregatesQuery(runID string) string {
	return fmt.Sprintf(`
SELECT
  run_id,
  frame_index,
  type,
  count() AS events_count
FROM telemetry_events
WHERE run_id = '%s'
GROUP BY run_id, frame_index, type
ORDER BY frame_index, type;
`, runID)
}

// GetFrameEndMetricsQuery возвращает SQL запрос для извлечения метрик производительности из frame.end.
func GetFrameEndMetricsQuery(runID string) string {
	return fmt.Sprintf(`
SELECT
  frame_index,
  sim_time,
  JSONExtractFloat(payload, 'dt') AS dt,
  JSONExtractInt(payload, 'substeps') AS substeps,
  JSONExtractFloat(payload, 'perf', 'cpu_time_ms') AS cpu_time_ms
FROM telemetry_events
WHERE run_id = '%s'
  AND type = 'frame.end'
ORDER BY frame_index;
`, runID)
}

// GetRunsByMetadataQuery возвращает SQL запрос для поиска run'ов по метаданным.
func GetRunsByMetadataQuery(sourceID, status string, daysBack int) string {
	return fmt.Sprintf(`
SELECT
  run_id,
  started_at,
  ended_at,
  status,
  total_events,
  total_frames,
  engine_version
FROM run_metadata
WHERE source_id = '%s'
  AND status = '%s'
  AND started_at >= now() - INTERVAL %d DAY
ORDER BY started_at DESC;
`, sourceID, status, daysBack)
}

// GetRunsByTagsQuery возвращает SQL запрос для поиска run'ов по тегам.
func GetRunsByTagsQuery(tagKey, tagValue string) string {
	return fmt.Sprintf(`
SELECT
  run_id,
  started_at,
  status,
  tags
FROM run_metadata
WHERE JSONExtractString(tags, '%s') = '%s'
ORDER BY started_at DESC;
`, tagKey, tagValue)
}

// GetCorrelationQuery возвращает SQL запрос для корреляционного анализа.
func GetCorrelationQuery(runID, eventType, sourceID, jsonPath1, jsonPath2 string) string {
	return fmt.Sprintf(`
WITH series AS (
  SELECT
    frame_index,
    JSONExtractFloat(payload, '%s') AS value1,
    JSONExtractFloat(payload, '%s') AS value2
  FROM telemetry_events
  WHERE run_id = '%s'
    AND type = '%s'
    AND source_id = '%s'
)
SELECT
  frame_index,
  value1,
  value2,
  value1 * value2 AS product
FROM series
WHERE value1 IS NOT NULL AND value2 IS NOT NULL
ORDER BY frame_index;
`, jsonPath1, jsonPath2, runID, eventType, sourceID)
}

// Вспомогательные функции

func sanitizeAlias(path string) string {
	// Заменяем точки и специальные символы на подчёркивания для alias
	result := ""
	for _, r := range path {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			result += string(r)
		} else {
			result += "_"
		}
	}
	return result
}

func joinStrings(strs []string, sep string) string {
	result := ""
	for i, s := range strs {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
