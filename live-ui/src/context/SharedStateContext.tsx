/**
 * SharedStateContext - контекст для централизованного управления состоянием UI
 * Реализует Stage 3: Shared State Engine
 *
 * Соответствует layout-контракту:
 * - time_cursor: синхронизация позиции по frameIndex/simTime
 * - selected_run: выбор активного run'а
 *
 * Ограничения Stage 3:
 * - Никаких данных, WebSocket, backend
 * - Никакой пользовательской интерактивности
 * - Только архитектурный механизм shared_state
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Layout } from '../types';

/**
 * Типы для shared_state согласно layout-контракту
 */
export interface TimeCursorState {
  axis: 'frameIndex' | 'simTime';
  value: number | null;
  sync_across?: string[];
}

export interface SelectedRunState {
  run_id: string | null;
  source: string | null;
}

export interface SharedState {
  time_cursor?: TimeCursorState;
  selected_run?: SelectedRunState;
}

/**
 * Контекст shared_state
 */
interface SharedStateContextValue {
  sharedState: SharedState;
  updateTimeCursor: (value: number | null) => void;
  updateTimeCursorAxis: (axis: 'frameIndex' | 'simTime') => void;
  updateSelectedRun: (run_id: string | null, source: string | null) => void;
  subscribe: (key: keyof SharedState, callback: (value: any) => void) => () => void;
}

const SharedStateContext = createContext<SharedStateContextValue | undefined>(undefined);

/**
 * Props для SharedStateProvider
 */
interface SharedStateProviderProps {
  children: ReactNode;
  initialSharedState?: Layout['shared_state'];
}

/**
 * SharedStateProvider - провайдер для shared_state
 * Инициализирует состояние из layout.shared_state
 */
export const SharedStateProvider: React.FC<SharedStateProviderProps> = ({
  children,
  initialSharedState,
}) => {
  // Инициализация состояния из layout.shared_state
  const [sharedState, setSharedState] = useState<SharedState>(() => {
    return {
      time_cursor: initialSharedState?.time_cursor || {
        axis: 'frameIndex',
        value: null,
        sync_across: [],
      },
      selected_run: initialSharedState?.selected_run || {
        run_id: null,
        source: null,
      },
    };
  });

  // Подписки на изменения (для будущего использования)
  const subscribersRef = React.useRef<
    Map<keyof SharedState, Set<(value: any) => void>>
  >(new Map());

  /**
   * Обновление time_cursor.value
   */
  const updateTimeCursor = useCallback((value: number | null) => {
    setSharedState((prev) => {
      const newState = {
        ...prev,
        time_cursor: {
          ...prev.time_cursor!,
          value,
        },
      };
      // Уведомляем подписчиков
      const callbacks = subscribersRef.current.get('time_cursor');
      if (callbacks) {
        callbacks.forEach((callback) => callback(newState.time_cursor));
      }
      return newState;
    });
  }, []);

  /**
   * Обновление time_cursor.axis
   */
  const updateTimeCursorAxis = useCallback((axis: 'frameIndex' | 'simTime') => {
    setSharedState((prev) => {
      const newState = {
        ...prev,
        time_cursor: {
          ...prev.time_cursor!,
          axis,
          // При смене оси сбрасываем value
          value: null,
        },
      };
      // Уведомляем подписчиков
      const callbacks = subscribersRef.current.get('time_cursor');
      if (callbacks) {
        callbacks.forEach((callback) => callback(newState.time_cursor));
      }
      return newState;
    });
  }, []);

  /**
   * Обновление selected_run
   */
  const updateSelectedRun = useCallback(
    (run_id: string | null, source: string | null) => {
      setSharedState((prev) => {
        const newState = {
          ...prev,
          selected_run: {
            run_id,
            source,
          },
        };
        // Уведомляем подписчиков
        const callbacks = subscribersRef.current.get('selected_run');
        if (callbacks) {
          callbacks.forEach((callback) => callback(newState.selected_run));
        }
        return newState;
      });
    },
    []
  );

  /**
   * Подписка на изменения shared_state
   * Возвращает функцию отписки
   */
  const subscribe = useCallback(
    (key: keyof SharedState, callback: (value: any) => void) => {
      if (!subscribersRef.current.has(key)) {
        subscribersRef.current.set(key, new Set());
      }
      subscribersRef.current.get(key)!.add(callback);

      // Возвращаем функцию отписки
      return () => {
        const callbacks = subscribersRef.current.get(key);
        if (callbacks) {
          callbacks.delete(callback);
        }
      };
    },
    []
  );

  const value: SharedStateContextValue = {
    sharedState,
    updateTimeCursor,
    updateTimeCursorAxis,
    updateSelectedRun,
    subscribe,
  };

  return (
    <SharedStateContext.Provider value={value}>
      {children}
    </SharedStateContext.Provider>
  );
};

/**
 * Хук для доступа к shared_state
 * @throws Error если используется вне SharedStateProvider
 */
export const useSharedState = (): SharedStateContextValue => {
  const context = useContext(SharedStateContext);
  if (context === undefined) {
    throw new Error(
      'useSharedState must be used within a SharedStateProvider'
    );
  }
  return context;
};

/**
 * Хук для подписки на конкретное поле shared_state
 * @param key - ключ в shared_state (time_cursor или selected_run)
 * @returns текущее значение и функцию для обновления
 */
export const useSharedStateField = <K extends keyof SharedState>(
  key: K
): [SharedState[K], (value: SharedState[K]) => void] => {
  const { sharedState, updateTimeCursor, updateTimeCursorAxis, updateSelectedRun } =
    useSharedState();

  const value = sharedState[key];

  const updateValue = useCallback(
    (newValue: SharedState[K]) => {
      if (key === 'time_cursor') {
        const timeCursor = newValue as TimeCursorState;
        if (timeCursor.value !== sharedState.time_cursor?.value) {
          updateTimeCursor(timeCursor.value);
        }
        if (timeCursor.axis !== sharedState.time_cursor?.axis) {
          updateTimeCursorAxis(timeCursor.axis);
        }
      } else if (key === 'selected_run') {
        const selectedRun = newValue as SelectedRunState;
        updateSelectedRun(selectedRun.run_id, selectedRun.source);
      }
    },
    [key, sharedState, updateTimeCursor, updateTimeCursorAxis, updateSelectedRun]
  );

  return [value, updateValue];
};
