/**
 * Валидатор для Layout и ChartSpec
 * Использует ajv для строгой валидации по JSON Schema
 */

import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import layoutSchema from '../schemas/layout.schema.json';
import chartSpecSchema from '../schemas/chartSpec.schema.json';
import type { Layout, ChartSpec, ValidationError } from '../types';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Компилируем схемы один раз при загрузке модуля
const validateLayoutSchema = ajv.compile(layoutSchema);
const validateChartSpecSchema = ajv.compile(chartSpecSchema);

/**
 * Преобразует ошибки ajv в читаемый формат
 */
function formatValidationErrors(errors: ErrorObject[]): ValidationError[] {
  return errors.map((error) => ({
    path: error.instancePath || '/',
    message: error.message || 'Validation error',
    schemaPath: error.schemaPath,
  }));
}

/**
 * Валидирует Layout по JSON Schema
 * @throws Error с детальным описанием ошибок валидации
 */
export function validateLayout(layout: unknown): asserts layout is Layout {
  if (!validateLayoutSchema(layout)) {
    const errors = formatValidationErrors(validateLayoutSchema.errors || []);
    const errorMessages = errors
      .map((err) => `  ${err.path}: ${err.message}`)
      .join('\n');
    throw new Error(
      `Layout validation failed:\n${errorMessages}\n\nLayout должен соответствовать контракту версии 1.0.`
    );
  }
}

/**
 * Валидирует ChartSpec по JSON Schema
 * @throws Error с детальным описанием ошибок валидации
 */
export function validateChartSpec(
  chartSpec: unknown
): asserts chartSpec is ChartSpec {
  if (!validateChartSpecSchema(chartSpec)) {
    const errors = formatValidationErrors(validateChartSpecSchema.errors || []);
    const errorMessages = errors
      .map((err) => `  ${err.path}: ${err.message}`)
      .join('\n');
    throw new Error(
      `ChartSpec validation failed:\n${errorMessages}\n\nChartSpec должен соответствовать контракту версии 1.0.`
    );
  }
}

/**
 * Валидирует все ChartSpec из объекта charts
 */
export function validateCharts(
  charts: Record<string, unknown>
): asserts charts is Record<string, ChartSpec> {
  const errors: string[] = [];

  for (const [chartId, chartSpec] of Object.entries(charts)) {
    try {
      validateChartSpec(chartSpec);
    } catch (error) {
      errors.push(`Chart "${chartId}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Charts validation failed:\n${errors.join('\n\n')}`);
  }
}
