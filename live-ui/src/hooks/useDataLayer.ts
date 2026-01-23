/**
 * React Hook для создания и управления Data Layer
 * Создает singleton Data Layer для всего приложения
 */

import { useEffect, useState, useRef } from 'react';
import { DataLayer } from '../data/layer';
import type { WSConnectionState } from '../data/websocket';
import type { WSRequest } from '../data/types';

/**
 * Hook для создания и управления Data Layer
 */
export function useDataLayer(options?: {
  wsUrl?: string;
  autoConnect?: boolean;
  initialRequest?: WSRequest;
}): {
  dataLayer: DataLayer | null;
  connectionState: WSConnectionState;
  connect: (request: WSRequest) => void;
  disconnect: () => void;
} {
  const [dataLayer, setDataLayer] = useState<DataLayer | null>(null);
  const [connectionState, setConnectionState] =
    useState<WSConnectionState>('disconnected');
  const dataLayerRef = useRef<DataLayer | null>(null);

  useEffect(() => {
    // Создаем Data Layer один раз
    if (!dataLayerRef.current) {
      const layer = new DataLayer({
        onStateChange: (state) => {
          setConnectionState(state);
        },
        onError: (error) => {
          console.error('DataLayer error:', error);
        },
      });

      dataLayerRef.current = layer;
      setDataLayer(layer);
      setConnectionState(layer.getConnectionState());
    }

    // Автоподключение если указано
    if (
      options?.autoConnect &&
      options?.initialRequest &&
      dataLayerRef.current
    ) {
      dataLayerRef.current.connect(options.initialRequest);
    }

    return () => {
      // Очистка при размонтировании
      if (dataLayerRef.current) {
        dataLayerRef.current.disconnect();
        dataLayerRef.current = null;
        setDataLayer(null);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = (request: WSRequest) => {
    if (dataLayerRef.current) {
      dataLayerRef.current.connect(request);
    }
  };

  const disconnect = () => {
    if (dataLayerRef.current) {
      dataLayerRef.current.disconnect();
    }
  };

  return {
    dataLayer,
    connectionState,
    connect,
    disconnect,
  };
}
