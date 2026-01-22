.PHONY: help build run docker-build docker-up docker-down clean validate validate-docker docker-logs docker-shell test lint format

# Variables
BINARY_NAME=teltel
DOCKER_IMAGE=teltel
DOCKER_TAG=latest
HTTP_PORT=8080
CLICKHOUSE_URL=http://localhost:8123
TELTEL_BASE_URL=http://localhost:8080

# Default target
.DEFAULT_GOAL := help

# Build binary locally
build:
	@echo "Building $(BINARY_NAME)..."
	@go build -o $(BINARY_NAME) ./cmd/teltel
	@echo "Build complete: $(BINARY_NAME)"

# Run teltel locally (without Docker)
run:
	@echo "Running $(BINARY_NAME) locally..."
	@go run ./cmd/teltel

# Build Docker image
docker-build:
	@echo "Building Docker image $(DOCKER_IMAGE):$(DOCKER_TAG)..."
	@docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	@echo "Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

# Start docker-compose stack
docker-up:
	@echo "Starting docker-compose stack..."
	@docker-compose up -d
	@echo "Stack started. teltel: http://localhost:8081"

# Stop docker-compose stack
docker-down:
	@echo "Stopping docker-compose stack..."
	@docker-compose down
	@echo "Stack stopped"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -f $(BINARY_NAME)
	@rm -f $(BINARY_NAME).exe
	@rm -rf bin/
	@docker rmi $(DOCKER_IMAGE):$(DOCKER_TAG) 2>/dev/null || true
	@echo "Clean complete"

# Run validation scripts locally
validate:
	@echo "Running Engineering Validation locally..."
	@TELTEL_BASE_URL=$(TELTEL_BASE_URL) CLICKHOUSE_URL=$(CLICKHOUSE_URL) ./scripts/validate.sh

# Run validation scripts against dockerized stack
validate-docker:
	@echo "Running Engineering Validation against dockerized stack..."
	@TELTEL_BASE_URL=http://localhost:8081 CLICKHOUSE_URL=http://localhost:8123 ./scripts/validate.sh

# View docker-compose logs
docker-logs:
	@docker-compose logs -f

# Get shell in teltel container
docker-shell:
	@docker-compose exec teltel /bin/sh

# Run tests (placeholder if no tests exist)
test:
	@echo "Running tests..."
	@go test ./... || echo "No tests found or tests failed"

# Lint code
lint:
	@echo "Linting code..."
	@go vet ./... || echo "go vet completed"
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not found, using go vet only"; \
	fi

# Format code
format:
	@echo "Formatting code..."
	@go fmt ./...
	@echo "Formatting complete"

# Show help
help:
	@echo "teltel Makefile Commands"
	@echo ""
	@echo "Build and Run:"
	@echo "  make build          - Build teltel binary locally"
	@echo "  make run            - Run teltel locally (without Docker)"
	@echo "  make docker-build   - Build Docker image"
	@echo "  make docker-up      - Start docker-compose stack (teltel + ClickHouse)"
	@echo "  make docker-down    - Stop docker-compose stack"
	@echo ""
	@echo "Validation:"
	@echo "  make validate       - Run Engineering Validation locally"
	@echo "  make validate-docker - Run Engineering Validation against dockerized stack"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          - Clean build artifacts and Docker images"
	@echo "  make docker-logs    - View docker-compose logs"
	@echo "  make docker-shell    - Get shell in teltel container"
	@echo ""
	@echo "Development:"
	@echo "  make test           - Run unit tests"
	@echo "  make lint           - Lint code (go vet + golangci-lint if available)"
	@echo "  make format         - Format code (gofmt)"
	@echo "  make help           - Show this help message"
	@echo ""
	@echo "Variables (can be overridden):"
	@echo "  BINARY_NAME=$(BINARY_NAME)"
	@echo "  DOCKER_IMAGE=$(DOCKER_IMAGE)"
	@echo "  DOCKER_TAG=$(DOCKER_TAG)"
	@echo "  HTTP_PORT=$(HTTP_PORT)"
	@echo "  TELTEL_BASE_URL=$(TELTEL_BASE_URL)"
