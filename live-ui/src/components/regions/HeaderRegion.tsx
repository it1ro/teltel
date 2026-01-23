/**
 * HeaderRegion - компонент для отображения header региона
 * Рендерит заглушки компонентов без данных и логики
 */

import React from 'react';
import type { HeaderRegion as HeaderRegionType } from '../../types';

interface HeaderRegionProps {
  spec: HeaderRegionType;
}

export const HeaderRegion: React.FC<HeaderRegionProps> = ({ spec }) => {
  const height = spec.height || '60px';

  return (
    <div
      style={{
        height,
        border: '1px solid #e0e0e0',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '16px',
      }}
    >
      {spec.components?.map((component) => (
        <ComponentPlaceholder key={component.id} component={component} />
      ))}
    </div>
  );
};

interface ComponentPlaceholderProps {
  component: {
    type: string;
    id: string;
    shared?: boolean;
  };
}

const ComponentPlaceholder: React.FC<ComponentPlaceholderProps> = ({
  component,
}) => {
  const getPlaceholderLabel = (type: string): string => {
    switch (type) {
      case 'run_selector':
        return 'Run Selector';
      case 'time_cursor':
        return 'Time Cursor';
      case 'status_indicator':
        return 'Status Indicator';
      case 'global_controls':
        return 'Global Controls';
      default:
        return type;
    }
  };

  return (
    <div
      style={{
        padding: '8px 16px',
        border: '1px dashed #999',
        borderRadius: '4px',
        backgroundColor: '#fff',
        color: '#666',
        fontSize: '14px',
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      {getPlaceholderLabel(component.type)}
      {component.shared && (
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            color: '#999',
            marginTop: '4px',
          }}
        >
          (shared)
        </span>
      )}
    </div>
  );
};
