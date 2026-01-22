package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/teltel/teltel/internal/api"
	"github.com/teltel/teltel/internal/buffer"
	"github.com/teltel/teltel/internal/config"
	"github.com/teltel/teltel/internal/eventbus"
	"github.com/teltel/teltel/internal/ingest"
)

func main() {
	cfg := config.Load()

	// Инициализация EventBus
	bus := eventbus.New()
	defer bus.Close()

	// Инициализация Live Buffer Manager
	bufferConfig := buffer.Config{
		Capacity:        cfg.BufferCapacity,
		MaxRuns:        cfg.BufferMaxRuns,
		CleanupInterval: cfg.BufferCleanupInterval,
	}
	bufferManager, err := buffer.NewManager(bus, bufferConfig)
	if err != nil {
		log.Fatalf("Failed to create buffer manager: %v", err)
	}
	defer bufferManager.Close()

	// Инициализация handlers
	ingestHandler := ingest.NewHandler(bus)
	httpHandler := api.NewHTTPHandler(bufferManager)
	wsHandler := api.NewWSHandler(bus)

	// Настройка HTTP роутинга
	mux := http.NewServeMux()

	// Ingest endpoint
	mux.HandleFunc("/ingest", ingestHandler.HandleIngest)

	// API endpoints
	mux.HandleFunc("/api/runs", httpHandler.HandleRuns)
	mux.HandleFunc("/api/run", httpHandler.HandleRun)
	mux.HandleFunc("/api/health", httpHandler.HandleHealth)

	// WebSocket endpoint
	mux.HandleFunc("/ws", wsHandler.HandleWebSocket)

	// Статические файлы (UI)
	webDir := filepath.Join(".", "web")
	fs := http.FileServer(http.Dir(webDir))
	mux.Handle("/", fs)

	// Создание HTTP сервера
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	_, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Обработка сигналов
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Запуск сервера в отдельной goroutine
	go func() {
		log.Printf("Starting teltel server on port %d", cfg.HTTPPort)
		log.Printf("Ingest endpoint: http://localhost:%d/ingest", cfg.HTTPPort)
		log.Printf("Web UI: http://localhost:%d", cfg.HTTPPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Ожидание сигнала завершения
	<-sigChan
	log.Println("Shutting down server...")

	// Graceful shutdown с таймаутом
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}
