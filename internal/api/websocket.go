package api

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/teltel/teltel/internal/eventbus"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// В Phase 1 разрешаем все origin (локальный сервис)
		return true
	},
}

// WSHandler обрабатывает WebSocket подключения для live-потока событий.
type WSHandler struct {
	bus eventbus.EventBus
}

// NewWSHandler создаёт новый WebSocket handler.
func NewWSHandler(bus eventbus.EventBus) *WSHandler {
	return &WSHandler{
		bus: bus,
	}
}

// WSRequest представляет запрос на подписку от клиента.
type WSRequest struct {
	RunID    string            `json:"runId,omitempty"`
	SourceID string            `json:"sourceId,omitempty"`
	Channel  string            `json:"channel,omitempty"`
	Types    []string          `json:"types,omitempty"`
	Tags     map[string]string `json:"tags,omitempty"`
}

// HandleWebSocket обрабатывает WebSocket подключение.
// Один клиент = одна EventBus подписка с policy drop_old.
func (h *WSHandler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Читаем запрос на подписку
	var req WSRequest
	if err := conn.ReadJSON(&req); err != nil {
		log.Printf("WebSocket read request error: %v", err)
		return
	}

	// Создаём фильтр из запроса
	filter := eventbus.Filter{
		RunID:    req.RunID,
		SourceID: req.SourceID,
		Channel:  req.Channel,
		Types:    req.Types,
		TagsAll:  req.Tags,
	}

	// Создаём подписку с policy drop_old
	opt := eventbus.SubscriptionOptions{
		BufferSize: 2048,
		Policy:     eventbus.BackpressureDropOld, // всегда drop_old для UI
		Name:       "websocket-client",
	}

	sub, err := h.bus.Subscribe(r.Context(), filter, opt)
	if err != nil {
		log.Printf("EventBus subscribe error: %v", err)
		return
	}

	// Важно: при отключении клиента обязательно закрываем subscription
	defer func() {
		if err := sub.Close(); err != nil {
			log.Printf("Subscription close error: %v", err)
		}
	}()

	// Настраиваем параметры соединения
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	conn.SetReadLimit(maxMessageSize)

	// Запускаем ping ticker
	pingTicker := time.NewTicker(pingPeriod)
	defer pingTicker.Stop()

	// Запускаем goroutine для чтения (для обработки закрытия клиента)
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}
		}
	}()

	// Отправляем события из подписки
	for {
		select {
		case event := <-sub.C():
			if event == nil {
				// Подписка закрыта
				return
			}

			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteJSON(event); err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}

		case <-pingTicker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}

		case <-done:
			return

		case <-r.Context().Done():
			return
		}
	}
}
