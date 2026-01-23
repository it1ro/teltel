/**
 * React Hook для работы с run'ами через Analysis API
 * Загрузка списка run'ов и метаданных
 */

import { useState, useEffect, useCallback } from 'react';
import { getAnalysisClient, type RunMetadata, type GetRunsParams } from '../data/analysis';

/**
 * Hook для получения списка run'ов
 */
export function useRuns(params?: GetRunsParams) {
  const [runs, setRuns] = useState<RunMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const client = getAnalysisClient();
      const data = await client.getRuns(params);
      setRuns(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load runs');
      setError(error);
      console.error('Failed to load runs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  return { runs, isLoading, error, reload: loadRuns };
}

/**
 * Hook для получения метаданных конкретного run'а
 */
export function useRun(runId: string | null) {
  const [run, setRun] = useState<RunMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setIsLoading(false);
      return;
    }

    const loadRun = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const client = getAnalysisClient();
        const data = await client.getRun(runId);
        setRun(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(`Failed to load run ${runId}`);
        setError(error);
        console.error(`Failed to load run ${runId}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRun();
  }, [runId]);

  return { run, isLoading, error };
}
