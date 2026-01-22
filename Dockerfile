# Stage 1: Build
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o teltel ./cmd/teltel

# Stage 2: Runtime
FROM alpine:latest

# Install CA certificates for HTTPS and wget for health checks
RUN apk --no-cache add ca-certificates wget

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/teltel .

# Copy web directory with static files
COPY --from=builder /build/web /app/web

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose default port
EXPOSE 8080

# Run teltel via entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
