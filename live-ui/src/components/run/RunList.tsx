/**
 * RunList - компонент для отображения списка доступных run'ов
 * Этап 8: UI компоненты для управления run'ами
 */

import React, { useMemo } from 'react';
import { useSharedState } from '../../context/SharedStateContext';
import { useRuns } from '../../hooks/useRuns';
import type { RunMetadata } from '../../data/analysis';

interface RunListProps {
  /**
   * ID компонента из layout
   */
  id: string;
  /**
   * Фильтры для загрузки run'ов
   */
  filters?: {
    status?: string[];
    sourceId?: string;
    daysBack?: number;
  };
  /**
   * Показывать ли детали run'а при клике
   */
  showDetails?: boolean;
}

/**
 * RunList отображает список доступных run'ов
 * При клике на run обновляет shared_state.selected_run
 */
export const RunList: React.FC<RunListProps> = ({
  id,
  filters,
  showDetails = false,
}) => {
  const { sharedState, updateSelectedRun } = useSharedState();
  const { runs, isLoading, error, reload } = useRuns({
    status: filters?.status?.join(','),
    sourceId: filters?.sourceId,
    daysBack: filters?.daysBack,
  });

  // Выбранный run из shared_state
  const selectedRunId = sharedState.selected_run?.run_id;

  // Обработка выбора run'а
  const handleSelectRun = (run: RunMetadata) => {
    updateSelectedRun(run.run_id, run.source_id || null);
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

  // Форматирование длительности
  const formatDuration = (seconds: number | null | undefined): string => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}с`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}м ${(seconds % 60).toFixed(0)}с`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${minutes}м`;
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

  // Сортировка run'ов: сначала running, затем по дате (новые первыми)
  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      // Running run'ы всегда первыми
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (a.status !== 'running' && b.status === 'running') return 1;
      // Затем по дате (новые первыми)
      const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
      const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [runs]);

  if (error) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          fontSize: '14px',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Ошибка загрузки</div>
        <div style={{ marginBottom: '8px' }}>{error.message}</div>
        <button
          onClick={reload}
          style={{
            padding: '6px 12px',
            backgroundColor: '#f44336',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
        }}
      >
        Загрузка run'ов...
      </div>
    );
  }

  if (sortedRuns.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: '#666',
          fontSize: '14px',
        }}
      >
        Нет доступных run'ов
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Заголовок с кнопкой обновления */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '8px',
          borderBottom: '1px solid #e0e0e0',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
          Run'ы ({sortedRuns.length})
        </div>
        <button
          onClick={reload}
          style={{
            padding: '4px 8px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          title="Обновить список"
        >
          ↻
        </button>
      </div>

      {/* Список run'ов */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        {sortedRuns.map((run) => {
          const isSelected = run.run_id === selectedRunId;

          return (
            <div
              key={run.run_id}
              onClick={() => handleSelectRun(run)}
              style={{
                padding: '12px',
                backgroundColor: isSelected ? '#e3f2fd' : '#fff',
                border: `1px solid ${isSelected ? '#2196f3' : '#e0e0e0'}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.backgroundColor = '#fff';
                }
              }}
            >
              {/* Заголовок run'а */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{run.run_id}</div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: getStatusColor(run.status),
                    color: '#fff',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                  }}
                >
                  {run.status}
                </span>
              </div>

              {/* Детали run'а */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#666',
                }}
              >
                <div>
                  <strong>Начало:</strong> {formatDate(run.started_at)}
                </div>
                {run.ended_at && (
                  <div>
                    <strong>Окончание:</strong> {formatDate(run.ended_at)}
                  </div>
                )}
                {run.duration_seconds && (
                  <div>
                    <strong>Длительность:</strong> {formatDuration(run.duration_seconds)}
                  </div>
                )}
                {run.total_frames && (
                  <div>
                    <strong>Кадры:</strong> {run.total_frames.toLocaleString()}
                  </div>
                )}
                {run.total_events && (
                  <div>
                    <strong>События:</strong> {run.total_events.toLocaleString()}
                  </div>
                )}
                {run.source_id && (
                  <div>
                    <strong>Источник:</strong> {run.source_id}
                  </div>
                )}
              </div>

              {/* Дополнительные детали (если showDetails) */}
              {showDetails && run.tags && Object.keys(run.tags).length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e0e0e0',
                    fontSize: '10px',
                    color: '#999',
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Теги:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Object.entries(run.tags).map(([key, value]) => (
                      <span
                        key={key}
                        style={{
                          padding: '2px 6px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '3px',
                        }}
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
