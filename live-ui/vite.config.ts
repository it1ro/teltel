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
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // Сохраняем путь /api/... при проксировании
        rewrite: (path) => path,
      },
      // Проксирование WebSocket подключений к backend
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
