/**
 * Loader для загрузки и валидации Layout конфигурации
 */

import { validateLayout, validateCharts } from './validator';
import type { Layout, ChartSpec } from '../types';

export interface LayoutConfig {
  layout: Layout;
  charts?: Record<string, ChartSpec>;
}

/**
 * Загружает и валидирует Layout из JSON
 * @param config - JSON объект с layout и опционально charts
 * @returns Валидированный LayoutConfig
 * @throws Error если конфигурация невалидна
 */
export function loadLayout(config: unknown): LayoutConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('Layout config must be an object');
  }

  const configObj = config as Record<string, unknown>;

  // Валидируем layout
  if (!configObj.layout) {
    throw new Error('Layout config must contain "layout" field');
  }

  validateLayout(configObj.layout);

  // Валидируем charts если они есть
  if (configObj.charts !== undefined) {
    if (typeof configObj.charts !== 'object' || configObj.charts === null) {
      throw new Error('Charts must be an object');
    }

    validateCharts(configObj.charts as Record<string, unknown>);
  }

  return {
    layout: configObj.layout as Layout,
    charts: configObj.charts as Record<string, ChartSpec> | undefined,
  };
}

/**
 * Загружает Layout из JSON файла (для использования в dev-режиме)
 * В production layout будет загружаться через API
 */
export async function loadLayoutFromFile(path: string): Promise<LayoutConfig> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load layout: ${response.statusText}`);
    }
    const config = await response.json();
    return loadLayout(config);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load layout from ${path}: ${error.message}`);
    }
    throw error;
  }
}
