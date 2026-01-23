/**
 * LeftPanelRegion - компонент для отображения left panel региона
 * Рендерит заглушки секций без данных и логики
 */

import React from 'react';
import type { LeftPanelRegion as LeftPanelRegionType } from '../../types';
import { RunList } from '../run/RunList';

interface LeftPanelRegionProps {
  spec: LeftPanelRegionType;
}

export const LeftPanelRegion: React.FC<LeftPanelRegionProps> = ({ spec }) => {
  const width = spec.width || '300px';

  return (
    <div
      style={{
        width,
        border: '1px solid #e0e0e0',
        backgroundColor: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        gap: '16px',
        overflowY: 'auto',
      }}
    >
      {spec.collapsible && (
        <div
          style={{
            fontSize: '12px',
            color: '#999',
            textAlign: 'right',
            paddingBottom: '8px',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          Collapsible
        </div>
      )}
      {spec.sections?.map((section) => {
        // Этап 8: Отображаем RunList для run_list
        if (section.type === 'run_list') {
          const filters = Array.isArray(section.filters)
            ? undefined
            : section.filters;
          return (
            <RunList
              key={section.id}
              id={section.id}
              filters={filters}
              showDetails={true}
            />
          );
        }

        // Для остальных секций используем заглушки
        return <SectionPlaceholder key={section.id} section={section} />;
      })}
    </div>
  );
};

interface SectionPlaceholderProps {
  section: {
    type: string;
    id: string;
    filters?: unknown;
    source?: string;
  };
}

const SectionPlaceholder: React.FC<SectionPlaceholderProps> = ({ section }) => {
  const getPlaceholderLabel = (type: string): string => {
    switch (type) {
      case 'run_list':
        return 'Run List';
      case 'filter_panel':
        return 'Filter Panel';
      case 'chart_visibility':
        return 'Chart Visibility';
      case 'series_selector':
        return 'Series Selector';
      default:
        return type;
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        border: '1px dashed #999',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#666',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        {getPlaceholderLabel(section.type)}
      </div>
      <div style={{ fontSize: '12px', color: '#999' }}>ID: {section.id}</div>
      {section.source && (
        <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
          Source: {section.source}
        </div>
      )}
    </div>
  );
};
