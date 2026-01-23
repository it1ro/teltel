/**
 * DataLayerContext - контекст для передачи DataLayer через приложение
 * Stage 5: позволяет ChartRenderer использовать useChartData
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { DataLayer } from '../data/layer';

interface DataLayerContextValue {
  dataLayer: DataLayer | null;
}

const DataLayerContext = createContext<DataLayerContextValue>({
  dataLayer: null,
});

interface DataLayerProviderProps {
  dataLayer: DataLayer | null;
  children: ReactNode;
}

/**
 * DataLayerProvider предоставляет DataLayer через контекст
 */
export const DataLayerProvider: React.FC<DataLayerProviderProps> = ({
  dataLayer,
  children,
}) => {
  return (
    <DataLayerContext.Provider value={{ dataLayer }}>
      {children}
    </DataLayerContext.Provider>
  );
};

/**
 * Hook для получения DataLayer из контекста
 */
export function useDataLayerContext(): DataLayer | null {
  const { dataLayer } = useContext(DataLayerContext);
  return dataLayer;
}
