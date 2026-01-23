/**
 * Главный компонент приложения
 * Загружает и валидирует layout, рендерит LayoutRenderer
 */

import React, { useEffect, useState } from 'react';
import { LayoutRenderer } from './components/layout/LayoutRenderer';
import { SharedStateProvider } from './context/SharedStateContext';
import { DataLayerProvider } from './context/DataLayerContext';
import { useDataLayer } from './hooks/useDataLayer';
import { loadLayout } from './utils/loader';
import type { LayoutConfig } from './utils/loader';

const App: React.FC = () => {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Создаём DataLayer на уровне App
  const { dataLayer } = useDataLayer({ autoConnect: false });

  useEffect(() => {
    // В dev-режиме загружаем пример layout из файла
    // В production это будет загружаться через API
    const loadDefaultLayout = async () => {
      try {
        // Загружаем layout из example-layout.json
        const response = await fetch('/example-layout.json');
        if (!response.ok) {
          throw new Error(`Failed to load layout: ${response.statusText}`);
        }
        const config = await response.json();
        const validated = loadLayout(config);
        setLayoutConfig(validated);
        setLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadDefaultLayout();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
        }}
      >
        Загрузка layout...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: '32px',
          fontFamily: 'monospace',
        }}
      >
        <div
          style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#d32f2f',
            marginBottom: '16px',
          }}
        >
          Ошибка загрузки layout
        </div>
        <div
          style={{
            backgroundColor: '#ffebee',
            border: '1px solid #d32f2f',
            borderRadius: '4px',
            padding: '16px',
            maxWidth: '800px',
            whiteSpace: 'pre-wrap',
            color: '#c62828',
          }}
        >
          {error}
        </div>
        <div
          style={{
            marginTop: '16px',
            fontSize: '14px',
            color: '#666',
          }}
        >
          UI не может стартовать с невалидным конфигом
        </div>
      </div>
    );
  }

  if (!layoutConfig) {
    return null;
  }

  return (
    <DataLayerProvider dataLayer={dataLayer}>
      <SharedStateProvider initialSharedState={layoutConfig.layout.shared_state}>
        <LayoutRenderer
          layout={layoutConfig.layout}
          charts={layoutConfig.charts}
        />
      </SharedStateProvider>
    </DataLayerProvider>
  );
};

export default App;
