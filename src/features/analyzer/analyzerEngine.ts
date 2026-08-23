import { getParamRange } from './types';
import type { LabParameter, LabTestDefinition, ParamStatus, PatternRule, Sex } from './types';

export interface ParamDeviation {
  param: LabParameter;
  status: ParamStatus;
  value: number;
  range: { min?: number; max?: number };
}

export interface AnalysisResult {
  statuses: Record<string, ParamStatus>;
  values: Record<string, number>;
  deviations: ParamDeviation[];
  matchedPatterns: PatternRule[];
  enteredCount: number;
}

function getStatus(value: number, range: { min?: number; max?: number }): ParamStatus {
  if (range.min !== undefined && value < range.min) return 'low';
  if (range.max !== undefined && value > range.max) return 'high';
  return 'normal';
}

export function analyzeTest(
  test: LabTestDefinition,
  values: Record<string, number | undefined>,
  sex: Sex,
  age?: number,
): AnalysisResult {
  const statuses: Record<string, ParamStatus> = {};
  const deviations: ParamDeviation[] = [];
  const numericValues: Record<string, number> = {};
  let enteredCount = 0;

  const evaluate = (param: LabParameter, value: number | undefined) => {
    if (value === undefined || Number.isNaN(value)) return;
    numericValues[param.key] = value;
    const range = getParamRange(param, sex, age);
    const status = getStatus(value, range);
    statuses[param.key] = status;
    if (status !== 'normal') deviations.push({ param, status, value, range });
  };

  for (const param of test.parameters) {
    if (param.inputType === 'derived') continue;
    const value = values[param.key];
    if (value === undefined || Number.isNaN(value)) continue;
    enteredCount++;
    evaluate(param, value);
  }

  // Derived params are computed after all directly entered values are known.
  for (const param of test.parameters) {
    if (param.inputType !== 'derived' || !param.derive) continue;
    evaluate(param, param.derive(numericValues));
  }

  const matchedPatterns = test.patterns.filter((pattern) => pattern.match(statuses, numericValues));

  return {
    statuses,
    values: numericValues,
    deviations,
    matchedPatterns,
    enteredCount,
  };
}
