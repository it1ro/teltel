/**
 * RunSelector - компонент для выбора run'ов
 * Поддерживает одиночный и множественный выбор для сравнения
 * Этап 8: UI компоненты для управления run'ами
 */

import React, { useState } from 'react';
import { useSharedState } from '../../context/SharedStateContext';
import { useRuns } from '../../hooks/useRuns';

interface RunSelectorProps {
  /**
   * ID компонента из layout
   */
  id: string;
  /**
   * Множественный выбор для сравнения run'ов
   */
  multiple?: boolean;
  /**
   * Максимальное количество выбранных run'ов (для multiple)
   */
  maxSelection?: number;
  /**
   * Фильтры для загрузки run'ов
   */
  filters?: {
    status?: string[];
    sourceId?: string;
    daysBack?: number;
  };
}

/**
 * RunSelector отображает выпадающий список доступных run'ов
 * При выборе обновляет shared_state.selected_run или selected_runs
 */
export const RunSelector: React.FC<RunSelectorProps> = ({
  id: _id,
  multiple = false,
  maxSelection = 2,
  filters,
}) => {
  const { sharedState, updateSelectedRun } = useSharedState();
  const { runs, isLoading, error } = useRuns({
    status: filters?.status?.join(','),
    sourceId: filters?.sourceId,
    daysBack: filters?.daysBack,
  });

  // Локальное состояние для множественного выбора
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>(() => {
    // Инициализация из shared_state (если есть selected_runs)
    const selectedRuns = (sharedState as any).selected_runs;
    if (selectedRuns && Array.isArray(selectedRuns)) {
      return selectedRuns.map((r: any) => r.run_id).filter(Boolean);
    }
    // Fallback на selected_run
    if (sharedState.selected_run?.run_id) {
      return [sharedState.selected_run.run_id];
    }
    return [];
  });

  // Обработка выбора run'а
  const handleSelect = (runId: string) => {
    if (multiple) {
      // Множественный выбор
      const newSelection = selectedRunIds.includes(runId)
        ? selectedRunIds.filter((id) => id !== runId)
        : selectedRunIds.length < maxSelection
        ? [...selectedRunIds, runId]
        : selectedRunIds;

      setSelectedRunIds(newSelection);

      // Обновляем shared_state (расширяем для поддержки selected_runs)
      // Пока используем временное решение через расширение shared_state
      const selectedRuns = newSelection.map((id) => {
        const run = runs.find((r) => r.run_id === id);
        return {
          run_id: id,
          source: run?.source_id || null,
        };
      });

      // Обновляем через updateSelectedRun (первый выбранный run)
      if (selectedRuns.length > 0) {
        updateSelectedRun(selectedRuns[0].run_id, selectedRuns[0].source);
      } else {
        updateSelectedRun(null, null);
      }

      // TODO: Добавить updateSelectedRuns в SharedStateContext для поддержки множественного выбора
    } else {
      // Одиночный выбор
      const run = runs.find((r) => r.run_id === runId);
      updateSelectedRun(runId, run?.source_id || null);
      setSelectedRunIds([runId]);
    }
  };

  // Форматирование даты для отображения
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Форматирование статуса
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return '#4caf50';
      case 'completed':
        return '#2196f3';
      case 'failed':
        return '#f44336';
      case 'cancelled':
        return '#ff9800';
      default:
        return '#757575';
    }
  };

  if (error) {
    return (
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '12px',
        }}
      >
        Ошибка загрузки: {error.message}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        minWidth: '200px',
      }}
    >
      <select
        value={multiple ? '' : selectedRunIds[0] || ''}
        onChange={(e) => {
          if (e.target.value) {
            handleSelect(e.target.value);
          }
        }}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: '#fff',
          cursor: isLoading ? 'not-allowed' : 'pointer',
        }}
      >
        <option value="">
          {isLoading ? 'Загрузка...' : multiple ? 'Выберите run\'ы' : 'Выберите run'}
        </option>
        {runs.map((run) => (
          <option key={run.run_id} value={run.run_id}>
            {run.run_id} ({run.status})
          </option>
        ))}
      </select>

      {/* Множественный выбор: отображение выбранных run'ов */}
      {multiple && selectedRunIds.length > 0 && (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {selectedRunIds.map((runId) => {
            const run = runs.find((r) => r.run_id === runId);
            if (!run) return null;

            return (
              <div
                key={runId}
                style={{
                  padding: '6px 10px',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{run.run_id}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    {formatDate(run.started_at)}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: getStatusColor(run.status),
                      color: '#fff',
                      fontSize: '10px',
                    }}
                  >
                    {run.status}
                  </span>
                  <button
                    onClick={() => handleSelect(runId)}
                    style={{
                      padding: '2px 6px',
                      border: 'none',
                      backgroundColor: '#f44336',
                      color: '#fff',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    title="Удалить"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          {selectedRunIds.length >= maxSelection && (
            <div
              style={{
                fontSize: '11px',
                color: '#ff9800',
                padding: '4px',
              }}
            >
              Максимум {maxSelection} run'ов
            </div>
          )}
        </div>
      )}
    </div>
  );
};
