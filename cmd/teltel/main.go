package main

import (
	"context"
	"encoding/json"
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
	"github.com/teltel/teltel/internal/storage"
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

	// Опциональная инициализация ClickHouse и Batcher (Phase 2/3)
	var analysisHandler *api.AnalysisHandler
	var batcher storage.Batcher
	if cfg.BatcherEnabled && cfg.ClickHouseURL != "" {
		// Инициализация ClickHouse client
		chClient := storage.NewHTTPClient(cfg.ClickHouseURL)

		// Инициализация schema
		schemaManager := storage.NewSchemaManager(chClient)
		ctx := context.Background()
		if err := schemaManager.InitSchema(ctx); err != nil {
			log.Printf("Warning: Failed to init ClickHouse schema: %v", err)
			log.Printf("Analysis endpoints will not be available")
		} else {
			log.Printf("ClickHouse schema initialized")

			// Создаём Analysis handler
			analysisHandler = api.NewAnalysisHandler(chClient)

			// Инициализация Batcher (опционально)
			batcherConfig := storage.BatcherConfig{
				ClickHouseURL: cfg.ClickHouseURL,
				BatchSize:     cfg.BatcherBatchSize,
				FlushInterval: cfg.BatcherFlushInterval,
				Filter:        eventbus.Filter{}, // все события
				BufferSize:    8192,
				Policy:        eventbus.BackpressureBlock,
				MaxRetries:    3,
				RetryBackoff:  100 * time.Millisecond,
			}
			batcher = storage.NewBatcher(bus, chClient, batcherConfig)
			if err := batcher.Start(ctx); err != nil {
				log.Printf("Warning: Failed to start batcher: %v", err)
			} else {
				log.Printf("Batcher started")
			}
		}
	}

	// Настройка HTTP роутинга
	mux := http.NewServeMux()

	// Ingest endpoint
	mux.HandleFunc("/api/ingest", ingestHandler.HandleIngest)

	// API endpoints (Phase 1 - live)
	mux.HandleFunc("/api/runs", httpHandler.HandleRuns)
	mux.HandleFunc("/api/run", httpHandler.HandleRun)
	mux.HandleFunc("/api/health", httpHandler.HandleHealth)

	// Analysis API endpoints (Phase 3 - post-run)
	if analysisHandler != nil {
		mux.HandleFunc("/api/analysis/runs", analysisHandler.HandleRuns)
		mux.HandleFunc("/api/analysis/run/", analysisHandler.HandleRun)
		mux.HandleFunc("/api/analysis/series", analysisHandler.HandleSeries)
		mux.HandleFunc("/api/analysis/compare", analysisHandler.HandleCompare)
		mux.HandleFunc("/api/analysis/query", analysisHandler.HandleQuery)
		log.Printf("Analysis API endpoints registered")
	}

	// WebSocket endpoint
	mux.HandleFunc("/ws", wsHandler.HandleWebSocket)

	// Статические файлы (UI)
	// #region agent log
	debugLog := func(data map[string]interface{}) {
		logEntry := map[string]interface{}{
			"sessionId":    "debug-session",
			"runId":        "run1",
			"timestamp":    time.Now().UnixMilli(),
			"location":     "main.go:110",
			"message":      "Static files setup",
			"data":         data,
		}
		if jsonData, err := json.Marshal(logEntry); err == nil {
			if f, err := os.OpenFile("/home/itiro/dev/teltel/.cursor/debug.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
				f.WriteString(string(jsonData) + "\n")
				f.Close()
			}
		}
	}
	// #endregion
	webDir := filepath.Join(".", "web")
	// #region agent log
	cwd, _ := os.Getwd()
	webDirAbs, _ := filepath.Abs(webDir)
	webDirExists := false
	if info, err := os.Stat(webDir); err == nil {
		webDirExists = info.IsDir()
	}
	debugLog(map[string]interface{}{
		"hypothesisId": "A",
		"webDir":       webDir,
		"webDirAbs":    webDirAbs,
		"cwd":          cwd,
		"webDirExists": webDirExists,
	})
	// #endregion
	fs := http.FileServer(http.Dir(webDir))
	// #region agent log
	debugLog(map[string]interface{}{
		"hypothesisId": "B",
		"fileServerCreated": true,
		"webDir": webDir,
	})
	// #endregion
	mux.Handle("/", fs)
	// #region agent log
	debugLog(map[string]interface{}{
		"hypothesisId": "C",
		"routeRegistered": "/",
		"handlerType": "FileServer",
	})
	// #endregion

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
		log.Printf("Ingest endpoint: http://localhost:%d/api/ingest", cfg.HTTPPort)
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

	// Остановка Batcher (если был запущен)
	if batcher != nil {
		log.Println("Stopping batcher...")
		if err := batcher.Stop(shutdownCtx); err != nil {
			log.Printf("Batcher stop error: %v", err)
		}
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}

	log.Println("Server stopped")
}
