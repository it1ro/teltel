/**
 * Типы для Layout и ChartSpec
 * Соответствуют JSON Schema контрактам
 */

export interface Layout {
  version: '1.0';
  layout_id: string;
  regions: {
    header?: HeaderRegion;
    left_panel?: LeftPanelRegion;
    main_panel?: MainPanelRegion;
  };
  shared_state?: {
    time_cursor?: {
      axis: 'frameIndex' | 'simTime';
      value: number | null;
      sync_across?: string[];
    };
    selected_run?: {
      run_id: string | null;
      source: string | null;
    };
  };
}

export interface HeaderRegion {
  region: 'header';
  height?: string;
  components?: HeaderComponent[];
}

export interface HeaderComponent {
  type: 'run_selector' | 'time_cursor' | 'status_indicator' | 'global_controls';
  id: string;
  shared?: boolean;
}

export interface LeftPanelRegion {
  region: 'left_panel';
  width?: string;
  collapsible?: boolean;
  sections?: LeftPanelSection[];
}

export interface LeftPanelSection {
  type: 'run_list' | 'filter_panel' | 'chart_visibility' | 'series_selector';
  id: string;
  filters?: {
    status?: string[];
  } | string[];
  source?: string;
}

export interface MainPanelRegion {
  region: 'main_panel';
  layout: 'grid';
  grid_config: {
    columns: number;
    rows?: number | 'auto';
    gap?: string;
  };
  charts: ChartReference[];
}

export interface ChartReference {
  chart_id: string;
  span: [number, number];
}

export interface ChartSpec {
  chart_id: string;
  version: '1.0';
  type:
    | 'time_series'
    | 'multi_axis_time_series'
    | 'event_timeline'
    | 'scatter'
    | 'histogram'
    | 'run_overview'
    | 'run_comparison';
  data_source: {
    type: 'event_stream' | 'aggregated' | 'derived' | 'historical' | 'hybrid';
    run_id?: string | null;
    run_ids?: string[];
    filters?: {
      channel?: string | null;
      type?: string | null;
      types?: string[];
      type_prefix?: string | null;
      tags?: Record<string, string>;
      // Для historical данных
      sourceId?: string | null;
      jsonPath?: string | null;
    };
    window?: {
      type: 'frames' | 'time' | 'all';
      size?: number;
      duration?: number;
    };
  };
  mappings?: {
    x?: AxisMapping;
    y?: AxisMapping;
    y2?: AxisMapping;
    color?: ColorMapping;
    size?: SizeMapping;
    shape?: ShapeMapping;
  };
  visual?: {
    mark?: 'line' | 'area' | 'point' | 'bar';
    stroke?: string | null;
    fill?: string | null;
    opacity?: number;
    strokeWidth?: number;
    interpolation?: 'linear' | 'curve' | 'step';
  };
  series?: SeriesSpec[];
  title?: string;
  description?: string | null;
  axes?: {
    x?: AxisConfig;
    y?: AxisConfig;
  };
  legend?: {
    show?: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  };
}

export interface AxisMapping {
  field: string;
  scale?: 'linear' | 'log';
  domain?: [number | null, number | null];
}

export interface ColorMapping {
  field: string;
  scale?: 'ordinal' | 'linear' | 'log';
  palette?: string[];
}

export interface SizeMapping {
  field: string;
  scale?: 'linear';
  range?: [number, number];
}

export interface ShapeMapping {
  field: string;
  mapping?: Record<string, string>;
}

export interface SeriesSpec {
  id: string;
  data_source?: Record<string, unknown>;
  mappings?: Record<string, unknown>;
  visual?: Record<string, unknown>;
}

export interface AxisConfig {
  label?: string;
  grid?: boolean;
  ticks?: 'auto' | number;
}

export interface ValidationError {
  path: string;
  message: string;
  schemaPath?: string;
}
