/**
 * LayoutRenderer - основной компонент для рендеринга декларативного layout
 * Читает валидированный layout и рендерит регионы
 */

import React from 'react';
import { HeaderRegion } from '../regions/HeaderRegion';
import { LeftPanelRegion } from '../regions/LeftPanelRegion';
import { MainPanelRegion } from '../regions/MainPanelRegion';
import type { Layout, ChartSpec } from '../../types';

interface LayoutRendererProps {
  layout: Layout;
  charts?: Record<string, ChartSpec>;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  layout,
  charts,
}) => {
  const { regions } = layout;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
      }}
    >
      {/* Header Region */}
      {regions.header && <HeaderRegion spec={regions.header} />}

      {/* Main Content Area */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left Panel Region */}
        {regions.left_panel && (
          <LeftPanelRegion spec={regions.left_panel} />
        )}

        {/* Main Panel Region */}
        {regions.main_panel && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MainPanelRegion spec={regions.main_panel} charts={charts} />
          </div>
        )}
      </div>
    </div>
  );
};
