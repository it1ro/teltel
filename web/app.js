// Конфигурация
const API_BASE = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;

// Состояние приложения
let currentRunId = null;
let ws = null;
let chart = null;
let chartData = {
    labels: [],
    datasets: [
        {
            label: 'frameIndex',
            data: [],
            borderColor: 'rgb(33, 150, 243)',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            tension: 0.1
        },
        {
            label: 'body.state.pos.x',
            data: [],
            borderColor: 'rgb(76, 175, 80)',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            tension: 0.1
        }
    ]
};

// Инициализация Chart.js
function initChart() {
    const ctx = document.getElementById('chart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
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
            },
            animation: {
                duration: 0 // отключаем анимацию для live-обновлений
            }
        }
    });
}

// Загрузка списка run'ов
async function loadRuns() {
    try {
        const response = await fetch(`${API_BASE}/api/runs`);
        const runs = await response.json();
        
        const runList = document.getElementById('runList');
        runList.innerHTML = '';
        
        if (runs.length === 0) {
            runList.innerHTML = '<div class="info">Нет активных run\'ов</div>';
            return;
        }
        
        runs.forEach(run => {
            const div = document.createElement('div');
            div.className = 'run-item';
            div.textContent = `${run.runId} (${run.sourceId || 'unknown'})`;
            div.onclick = () => selectRun(run.runId);
            if (run.runId === currentRunId) {
                div.classList.add('active');
            }
            runList.appendChild(div);
        });
    } catch (error) {
        console.error('Ошибка загрузки run\'ов:', error);
    }
}

// Выбор run'а
function selectRun(runId) {
    if (currentRunId === runId) {
        return;
    }
    
    currentRunId = runId;
    updateStatus('disconnected', 'Переподключение...');
    
    // Закрываем предыдущее соединение
    if (ws) {
        ws.close();
    }
    
    // Очищаем график
    chartData.labels = [];
    chartData.datasets[0].data = [];
    chartData.datasets[1].data = [];
    chart.update();
    
    // Обновляем UI
    document.querySelectorAll('.run-item').forEach(item => {
        item.classList.remove('active');
        if (item.textContent.includes(runId)) {
            item.classList.add('active');
        }
    });
    
    // Подключаемся к WebSocket
    connectWebSocket(runId);
}

// Подключение к WebSocket
function connectWebSocket(runId) {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        updateStatus('connected', 'Подключено');
        
        // Отправляем запрос на подписку
        ws.send(JSON.stringify({
            runId: runId
        }));
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleEvent(data);
        } catch (error) {
            console.error('Ошибка парсинга события:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('disconnected', 'Ошибка подключения');
    };
    
    ws.onclose = () => {
        updateStatus('disconnected', 'Отключено');
        ws = null;
    };
}

// Обработка события
function handleEvent(event) {
    // Добавляем frameIndex на ось X
    chartData.labels.push(event.frameIndex);
    
    // Добавляем frameIndex как первую серию (для демонстрации)
    chartData.datasets[0].data.push({
        x: event.frameIndex,
        y: event.frameIndex
    });
    
    // Извлекаем body.state.pos.x из payload (жёстко заданный путь)
    let posX = null;
    try {
        const payload = JSON.parse(event.payload);
        if (payload.body && payload.body.state && payload.body.state.pos && payload.body.state.pos.x !== undefined) {
            posX = payload.body.state.pos.x;
        }
    } catch (e) {
        // Payload не парсится или путь не найден - пропускаем
    }
    
    if (posX !== null) {
        chartData.datasets[1].data.push({
            x: event.frameIndex,
            y: posX
        });
    }
    
    // Ограничиваем количество точек на графике (последние 1000)
    const maxPoints = 1000;
    if (chartData.labels.length > maxPoints) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
        chartData.datasets[1].data.shift();
    }
    
    // Обновляем график
    chart.update('none'); // 'none' для отключения анимации
}

// Обновление статуса
function updateStatus(status, text) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${status}`;
    statusEl.textContent = text;
}

// Инициализация
initChart();
loadRuns();

// Обновляем список run'ов каждые 5 секунд
setInterval(loadRuns, 5000);
