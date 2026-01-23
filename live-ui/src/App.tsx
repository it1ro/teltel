/**
 * Главный компонент приложения
 * Загружает и валидирует layout, рендерит LayoutRenderer
 */

import React, { useEffect, useState } from 'react';
import { LayoutRenderer } from './components/layout/LayoutRenderer';
import { loadLayout } from './utils/loader';
import type { LayoutConfig } from './utils/loader';

const App: React.FC = () => {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // В dev-режиме загружаем пример layout из файла
    // В production это будет загружаться через API
    const loadDefaultLayout = async () => {
      try {
        // Пример layout для демонстрации
        const defaultLayout: LayoutConfig = {
          layout: {
            version: '1.0',
            layout_id: 'default',
            regions: {
              header: {
                region: 'header',
                height: '60px',
                components: [
                  { type: 'run_selector', id: 'run_selector_1' },
                  { type: 'time_cursor', id: 'time_cursor_1', shared: true },
                  { type: 'status_indicator', id: 'status_1' },
                ],
              },
              left_panel: {
                region: 'left_panel',
                width: '300px',
                collapsible: true,
                sections: [
                  {
                    type: 'run_list',
                    id: 'run_list_1',
                    filters: { status: ['running', 'completed'] },
                  },
                  {
                    type: 'filter_panel',
                    id: 'filter_panel_1',
                    filters: ['channel', 'type', 'tags'],
                  },
                ],
              },
              main_panel: {
                region: 'main_panel',
                layout: 'grid',
                grid_config: {
                  columns: 2,
                  rows: 'auto',
                  gap: '16px',
                },
                charts: [
                  { chart_id: 'chart_1', span: [1, 2] },
                  { chart_id: 'chart_2', span: [1, 1] },
                  { chart_id: 'chart_3', span: [1, 1] },
                ],
              },
            },
            shared_state: {
              time_cursor: {
                axis: 'frameIndex',
                value: null,
                sync_across: ['main_panel.charts'],
              },
            },
          },
        };

        // Валидируем layout
        const validated = loadLayout({ layout: defaultLayout.layout });
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

  return <LayoutRenderer layout={layoutConfig.layout} />;
};

export default App;
