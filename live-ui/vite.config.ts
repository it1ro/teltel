import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // Проксирование HTTP API запросов к backend
      // В dev-режиме Vite проксирует /api/* к http://localhost:8080/api/*
      // Обеспечивает единообразие с production (nginx proxy)
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Сохраняем путь /api/... при проксировании
        rewrite: (path) => path,
      },
      // Проксирование WebSocket подключений к backend
      // В dev-режиме Vite проксирует /ws к ws://localhost:8080/ws
      // Обеспечивает единообразие с production (nginx proxy)
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        // Сохраняем путь /ws при проксировании
        rewrite: (path) => path,
      },
    },
  },
});
