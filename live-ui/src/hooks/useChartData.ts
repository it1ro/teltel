/**
 * React Hook для доступа к данным графика
 * Тонкий bridge к Data Layer
 */

import { useEffect, useState, useRef } from 'react';
import type { ChartSpec } from '../types';
import type { Series } from '../data/types';
import { DataLayer } from '../data/layer';

/**
 * Hook для получения данных графика
 * Подписывается на Data Layer и возвращает данные
 */
export function useChartData(
  chartSpec: ChartSpec,
  dataLayer: DataLayer | null
): {
  series: Series[];
  isLoading: boolean;
  error: Error | null;
} {
  const [series, setSeries] = useState<Series[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!dataLayer || !chartSpec) {
      setIsLoading(false);
      return;
    }

    // Функция обновления данных
    const updateData = () => {
      try {
        const newSeries = dataLayer.getSeries(chartSpec);
        setSeries(newSeries);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to get series');
        setError(error);
        setIsLoading(false);
      }
    };

    // Первоначальное обновление
    updateData();

    // Подписка на обновления (проверяем каждые 100ms)
    updateIntervalRef.current = setInterval(updateData, 100);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [chartSpec, dataLayer]);

  return { series, isLoading, error };
}
