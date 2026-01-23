/**
 * WebSocket Client для подключения к teltel
 * Изолирован от React, не хранит UI-состояние
 */

import type { Event, WSRequest } from './types';
import { getWebSocketUrl } from '../utils/config';

export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WSClientCallbacks {
  onEvent?: (event: Event) => void;
  onStateChange?: (state: WSConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface WSClientOptions {
  url?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

const DEFAULT_OPTIONS: Required<WSClientOptions> = {
  url: getWebSocketUrl(),
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
};

/**
 * WebSocket клиент для teltel
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private state: WSConnectionState = 'disconnected';
  private callbacks: WSClientCallbacks;
  private options: Required<WSClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentRequest: WSRequest | null = null;

  constructor(callbacks: WSClientCallbacks, options?: WSClientOptions) {
    this.callbacks = callbacks;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Подключение к WebSocket с подпиской
   */
  connect(request: WSRequest): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Уже подключен, отправляем новый запрос
      this.sendRequest(request);
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      // Подключение в процессе, сохраняем запрос
      this.currentRequest = request;
      return;
    }

    this.currentRequest = request;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setState('connecting');

    try {
      const ws = new WebSocket(this.options.url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState('connected');

        // Отправляем запрос на подписку
        if (this.currentRequest) {
          this.sendRequest(this.currentRequest);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.callbacks.onEvent) {
            this.callbacks.onEvent(data as Event);
          }
        } catch (error) {
          if (this.callbacks.onError) {
            this.callbacks.onError(
              error instanceof Error
                ? error
                : new Error('Failed to parse WebSocket message')
            );
          }
        }
      };

      ws.onerror = (error) => {
        if (this.callbacks.onError) {
          this.callbacks.onError(
            error instanceof Error
              ? error
              : new Error('WebSocket error occurred')
          );
        }
        this.setState('error');
      };

      ws.onclose = () => {
        this.ws = null;
        this.setState('disconnected');

        // Попытка переподключения
        if (this.options.reconnect && this.currentRequest) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      if (this.callbacks.onError) {
        this.callbacks.onError(
          error instanceof Error
            ? error
            : new Error('Failed to create WebSocket connection')
        );
      }
      this.setState('error');

      if (this.options.reconnect && this.currentRequest) {
        this.scheduleReconnect();
      }
    }
  }

  private sendRequest(request: WSRequest): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        if (this.callbacks.onError) {
          this.callbacks.onError(
            error instanceof Error
              ? error
              : new Error('Failed to send WebSocket request')
          );
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      if (this.callbacks.onError) {
        this.callbacks.onError(
          new Error(
            `Max reconnect attempts (${this.options.maxReconnectAttempts}) reached`
          )
        );
      }
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, this.options.reconnectDelay);
  }

  private setState(state: WSConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      if (this.callbacks.onStateChange) {
        this.callbacks.onStateChange(state);
      }
    }
  }

  /**
   * Обновление подписки (отправка нового запроса)
   */
  updateSubscription(request: WSRequest): void {
    this.currentRequest = request;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendRequest(request);
    } else if (this.state === 'disconnected' || this.state === 'error') {
      this.connect(request);
    }
  }

  /**
   * Закрытие соединения
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.currentRequest = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /**
   * Текущее состояние соединения
   */
  getState(): WSConnectionState {
    return this.state;
  }
}
