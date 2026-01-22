// Конфигурация
const API_BASE = window.location.origin;

// Состояние приложения
let currentRunId = null;
let seriesChart = null;
let compareChart = null;

// Инициализация графиков
function initCharts() {
    // График для временных рядов
    const seriesCtx = document.getElementById('seriesChart').getContext('2d');
    seriesChart = new Chart(seriesCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frame Index'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });

    // График для сравнения
    const compareCtx = document.getElementById('compareChart').getContext('2d');
    compareChart = new Chart(compareCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Frame Index'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });
}

// Показ статуса
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 5000);
}

// Загрузка списка run'ов
async function loadRuns() {
    try {
        const sourceId = document.getElementById('filterSourceId').value;
        const status = document.getElementById('filterStatus').value;
        const daysBack = document.getElementById('filterDaysBack').value || 30;

        let url = `${API_BASE}/api/analysis/runs?daysBack=${daysBack}`;
        if (sourceId) url += `&sourceId=${encodeURIComponent(sourceId)}`;
        if (status) url += `&status=${encodeURIComponent(status)}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonText = await response.text();
        const runs = parseJSONEachRow(jsonText);

        const runList = document.getElementById('runList');
        runList.innerHTML = '';

        if (runs.length === 0) {
            runList.innerHTML = '<div class="info">No runs found</div>';
            return;
        }

        runs.forEach(run => {
            const div = document.createElement('div');
            div.className = 'run-item';
            div.innerHTML = `
                <strong>${run.run_id}</strong><br>
                <small>${run.source_id || 'unknown'} | ${run.status || 'unknown'} | ${formatDate(run.started_at)}</small>
            `;
            div.onclick = () => selectRun(run.run_id);
            if (run.run_id === currentRunId) {
                div.classList.add('active');
            }
            runList.appendChild(div);
        });

        showStatus(`Loaded ${runs.length} run(s)`, 'info');
    } catch (error) {
        console.error('Error loading runs:', error);
        showStatus(`Error loading runs: ${error.message}`, 'error');
    }
}

// Выбор run'а
async function selectRun(runId) {
    currentRunId = runId;

    // Обновляем UI
    document.querySelectorAll('.run-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.includes(runId)) {
            item.classList.add('active');
        }
    });

    // Загружаем метаданные
    await loadRunMetadata(runId);

    // Заполняем поля формы для series
    document.getElementById('seriesEventType').value = '';
    document.getElementById('seriesSourceId').value = '';
    document.getElementById('seriesJsonPath').value = '';
}

// Загрузка метаданных run'а
async function loadRunMetadata(runId) {
    try {
        const response = await fetch(`${API_BASE}/api/analysis/run/${encodeURIComponent(runId)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonText = await response.text();
        const metadata = parseJSONEachRow(jsonText);

        if (metadata.length === 0) {
            document.getElementById('runMetadata').innerHTML = '<div class="info">Metadata not found</div>';
            return;
        }

        const m = metadata[0];
        document.getElementById('runMetadata').innerHTML = `
            <div><strong>Run ID:</strong> ${m.run_id}</div>
            <div><strong>Source ID:</strong> ${m.source_id || 'N/A'}</div>
            <div><strong>Status:</strong> ${m.status || 'N/A'}</div>
            <div><strong>Started:</strong> ${formatDate(m.started_at)}</div>
            <div><strong>Ended:</strong> ${m.ended_at ? formatDate(m.ended_at) : 'N/A'}</div>
            <div><strong>Duration:</strong> ${m.duration_seconds ? m.duration_seconds.toFixed(2) + 's' : 'N/A'}</div>
            <div><strong>Total Events:</strong> ${m.total_events || 0}</div>
            <div><strong>Total Frames:</strong> ${m.total_frames || 0}</div>
            <div><strong>Max Frame:</strong> ${m.max_frame_index || 0}</div>
            <div><strong>Engine Version:</strong> ${m.engine_version || 'N/A'}</div>
            ${m.seed ? `<div><strong>Seed:</strong> ${m.seed}</div>` : ''}
            ${m.end_reason ? `<div><strong>End Reason:</strong> ${m.end_reason}</div>` : ''}
        `;
    } catch (error) {
        console.error('Error loading metadata:', error);
        document.getElementById('runMetadata').innerHTML = `<div class="info">Error: ${error.message}</div>`;
    }
}

// Загрузка временного ряда
async function loadSeries() {
    if (!currentRunId) {
        showStatus('Please select a run first', 'error');
        return;
    }

    const eventType = document.getElementById('seriesEventType').value.trim();
    const sourceId = document.getElementById('seriesSourceId').value.trim();
    const jsonPath = document.getElementById('seriesJsonPath').value.trim();

    if (!eventType || !sourceId || !jsonPath) {
        showStatus('Please fill all fields: Event Type, Source ID, JSON Path', 'error');
        return;
    }

    try {
        const btn = document.getElementById('loadSeriesBtn');
        btn.disabled = true;
        btn.textContent = 'Loading...';

        const url = `${API_BASE}/api/analysis/series?runId=${encodeURIComponent(currentRunId)}&eventType=${encodeURIComponent(eventType)}&sourceId=${encodeURIComponent(sourceId)}&jsonPath=${encodeURIComponent(jsonPath)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonText = await response.text();
        const data = parseJSONEachRow(jsonText);

        if (data.length === 0) {
            showStatus('No data found for this series', 'info');
            seriesChart.data.labels = [];
            seriesChart.data.datasets = [];
            seriesChart.update();
            return;
        }

        // Формируем SQL запрос для отображения
        const sqlQuery = `SELECT\n  frame_index,\n  sim_time,\n  JSONExtractFloat(payload, '${jsonPath}') AS value\nFROM telemetry_events\nWHERE run_id = '${currentRunId}'\n  AND type = '${eventType}'\n  AND source_id = '${sourceId}'\nORDER BY frame_index;`;
        document.getElementById('seriesSql').textContent = sqlQuery;
        document.getElementById('seriesSqlDisplay').style.display = 'block';

        // Обновляем график
        const labels = data.map(d => d.frame_index);
        const values = data.map(d => d.value);

        seriesChart.data.labels = labels;
        seriesChart.data.datasets = [{
            label: `${eventType} / ${sourceId} / ${jsonPath}`,
            data: values,
            borderColor: 'rgb(33, 150, 243)',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.1
        }];
        seriesChart.update();

        showStatus(`Loaded ${data.length} data points`, 'info');
    } catch (error) {
        console.error('Error loading series:', error);
        showStatus(`Error loading series: ${error.message}`, 'error');
    } finally {
        const btn = document.getElementById('loadSeriesBtn');
        btn.disabled = false;
        btn.textContent = 'Load Series';
    }
}

// Сравнение run'ов
async function loadCompare() {
    const runId1 = document.getElementById('compareRunId1').value.trim();
    const runId2 = document.getElementById('compareRunId2').value.trim();
    const eventType = document.getElementById('compareEventType').value.trim();
    const sourceId = document.getElementById('compareSourceId').value.trim();
    const jsonPath = document.getElementById('compareJsonPath').value.trim();

    if (!runId1 || !runId2 || !eventType || !sourceId || !jsonPath) {
        showStatus('Please fill all fields', 'error');
        return;
    }

    try {
        const btn = document.getElementById('loadCompareBtn');
        btn.disabled = true;
        btn.textContent = 'Loading...';

        const url = `${API_BASE}/api/analysis/compare?runId1=${encodeURIComponent(runId1)}&runId2=${encodeURIComponent(runId2)}&eventType=${encodeURIComponent(eventType)}&sourceId=${encodeURIComponent(sourceId)}&jsonPath=${encodeURIComponent(jsonPath)}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const jsonText = await response.text();
        const data = parseJSONEachRow(jsonText);

        if (data.length === 0) {
            showStatus('No data found for comparison', 'info');
            compareChart.data.labels = [];
            compareChart.data.datasets = [];
            compareChart.update();
            return;
        }

        // Формируем SQL запрос для отображения
        const sqlQuery = `SELECT\n  r1.frame_index,\n  r1.sim_time AS sim_time_1,\n  r2.sim_time AS sim_time_2,\n  JSONExtractFloat(r1.payload, '${jsonPath}') AS value_1,\n  JSONExtractFloat(r2.payload, '${jsonPath}') AS value_2,\n  JSONExtractFloat(r2.payload, '${jsonPath}') - JSONExtractFloat(r1.payload, '${jsonPath}') AS diff\nFROM telemetry_events AS r1\nINNER JOIN telemetry_events AS r2\n  ON r1.frame_index = r2.frame_index\nWHERE r1.run_id = '${runId1}'\n  AND r2.run_id = '${runId2}'\n  AND r1.type = '${eventType}'\n  AND r2.type = '${eventType}'\n  AND r1.source_id = '${sourceId}'\n  AND r2.source_id = '${sourceId}'\nORDER BY r1.frame_index;`;
        document.getElementById('compareSql').textContent = sqlQuery;
        document.getElementById('compareSqlDisplay').style.display = 'block';

        // Обновляем график
        const labels = data.map(d => d.frame_index);
        const values1 = data.map(d => d.value_1);
        const values2 = data.map(d => d.value_2);

        compareChart.data.labels = labels;
        compareChart.data.datasets = [
            {
                label: `${runId1}`,
                data: values1,
                borderColor: 'rgb(33, 150, 243)',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                tension: 0.1
            },
            {
                label: `${runId2}`,
                data: values2,
                borderColor: 'rgb(76, 175, 80)',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.1
            }
        ];
        compareChart.update();

        showStatus(`Compared ${data.length} data points`, 'info');
    } catch (error) {
        console.error('Error comparing runs:', error);
        showStatus(`Error comparing runs: ${error.message}`, 'error');
    } finally {
        const btn = document.getElementById('loadCompareBtn');
        btn.disabled = false;
        btn.textContent = 'Compare';
    }
}

// Копирование SQL
function copySql(elementId) {
    const sqlText = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(sqlText).then(() => {
        showStatus('SQL query copied to clipboard', 'info');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy SQL', 'error');
    });
}

// Парсинг JSONEachRow формата
function parseJSONEachRow(text) {
    if (!text || text.trim() === '') {
        return [];
    }
    const lines = text.trim().split('\n');
    return lines.map(line => {
        try {
            return JSON.parse(line);
        } catch (e) {
            console.error('Failed to parse line:', line, e);
            return null;
        }
    }).filter(item => item !== null);
}

// Форматирование даты
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString();
    } catch (e) {
        return dateStr;
    }
}

// Инициализация
initCharts();
