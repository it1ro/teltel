/**
 * SharedStateContext - контекст для централизованного управления состоянием UI
 * Реализует Stage 3: Shared State Engine
 * Расширен в Stage 7.1: Интерактивные состояния
 *
 * Соответствует layout-контракту:
 * - time_cursor: синхронизация позиции по frameIndex/simTime
 * - selected_run: выбор активного run'а
 *
 * Stage 7.1 расширения (опциональные):
 * - interaction_state: zoom и pan состояния
 * - live_mode: управление воспроизведением
 * - hover_state: состояние hover на графиках
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

/**
 * Состояние интерактивности (zoom и pan)
 * Stage 7.1: опциональное расширение
 */
export interface InteractionState {
  zoom?: {
    x?: [number, number];
    y?: [number, number];
  };
  pan?: {
    x?: number;
    y?: number;
  };
}

/**
 * Состояние live-режима (воспроизведение)
 * Stage 7.1: опциональное расширение
 */
export interface LiveModeState {
  is_playing: boolean;
  playback_speed?: number;
}

/**
 * Состояние hover на графике
 * Stage 7.1: опциональное расширение
 */
export interface HoverState {
  chart_id: string;
  x: number;
  y: number;
  data?: unknown;
}

/**
 * SharedState - централизованное состояние UI
 * 
 * Базовые поля (Stage 3):
 * - time_cursor: синхронизация позиции по времени
 * - selected_run: выбор активного run'а
 * 
 * Расширения Stage 7.1 (опциональные):
 * - interaction_state: zoom и pan
 * - live_mode: управление воспроизведением
 * - hover_state: состояние hover на графиках
 */
export interface SharedState {
  time_cursor?: TimeCursorState;
  selected_run?: SelectedRunState;
  // Stage 7.1: опциональные расширения для интерактивности
  interaction_state?: InteractionState;
  live_mode?: LiveModeState;
  hover_state?: HoverState | null;
}

/**
 * Контекст shared_state
 */
interface SharedStateContextValue {
  sharedState: SharedState;
  // Базовые методы (Stage 3)
  updateTimeCursor: (value: number | null) => void;
  updateTimeCursorAxis: (axis: 'frameIndex' | 'simTime') => void;
  updateSelectedRun: (run_id: string | null, source: string | null) => void;
  // Stage 7.1: методы для интерактивных состояний
  updateInteractionState: (state: InteractionState | ((prev: InteractionState | undefined) => InteractionState)) => void;
  updateLiveMode: (mode: LiveModeState | ((prev: LiveModeState | undefined) => LiveModeState)) => void;
  updateHoverState: (state: HoverState | null) => void;
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
   * Обновление interaction_state (Stage 7.1)
   * Поддерживает как прямое значение, так и функцию обновления
   */
  const updateInteractionState = useCallback(
    (state: InteractionState | ((prev: InteractionState | undefined) => InteractionState)) => {
      setSharedState((prev) => {
        const newInteractionState =
          typeof state === 'function' ? state(prev.interaction_state) : state;
        const newState = {
          ...prev,
          interaction_state: newInteractionState,
        };
        // Уведомляем подписчиков
        const callbacks = subscribersRef.current.get('interaction_state');
        if (callbacks) {
          callbacks.forEach((callback) => callback(newState.interaction_state));
        }
        return newState;
      });
    },
    []
  );

  /**
   * Обновление live_mode (Stage 7.1)
   * Поддерживает как прямое значение, так и функцию обновления
   */
  const updateLiveMode = useCallback(
    (mode: LiveModeState | ((prev: LiveModeState | undefined) => LiveModeState)) => {
      setSharedState((prev) => {
        const newLiveMode = typeof mode === 'function' ? mode(prev.live_mode) : mode;
        const newState = {
          ...prev,
          live_mode: newLiveMode,
        };
        // Уведомляем подписчиков
        const callbacks = subscribersRef.current.get('live_mode');
        if (callbacks) {
          callbacks.forEach((callback) => callback(newState.live_mode));
        }
        return newState;
      });
    },
    []
  );

  /**
   * Обновление hover_state (Stage 7.1)
   */
  const updateHoverState = useCallback((state: HoverState | null) => {
    setSharedState((prev) => {
      const newState = {
        ...prev,
        hover_state: state,
      };
      // Уведомляем подписчиков
      const callbacks = subscribersRef.current.get('hover_state');
      if (callbacks) {
        callbacks.forEach((callback) => callback(newState.hover_state));
      }
      return newState;
    });
  }, []);

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
    updateInteractionState,
    updateLiveMode,
    updateHoverState,
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
  const {
    sharedState,
    updateTimeCursor,
    updateTimeCursorAxis,
    updateSelectedRun,
    updateInteractionState,
    updateLiveMode,
    updateHoverState,
  } = useSharedState();

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
      } else if (key === 'interaction_state') {
        const interactionState = newValue as InteractionState | undefined;
        updateInteractionState(interactionState || {});
      } else if (key === 'live_mode') {
        const liveMode = newValue as LiveModeState | undefined;
        if (liveMode) {
          updateLiveMode(liveMode);
        }
      } else if (key === 'hover_state') {
        const hoverState = newValue as HoverState | null | undefined;
        updateHoverState(hoverState ?? null);
      }
    },
    [
      key,
      sharedState,
      updateTimeCursor,
      updateTimeCursorAxis,
      updateSelectedRun,
      updateInteractionState,
      updateLiveMode,
      updateHoverState,
    ]
  );

  return [value, updateValue];
};
