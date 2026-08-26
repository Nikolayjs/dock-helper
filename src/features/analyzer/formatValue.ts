import type { LabParameter } from './types';

/**
 * Renders a parameter's value the way its own input field renders it.
 *
 * The results panel was printing the raw number, which only showed on computed parameters: the
 * field displayed `0.12` for the absolute basophil count while the deviation card beside it read
 * `0.12446`, and two different numbers for one result read as a bug in the arithmetic.
 *
 * Rounding is display only. The engine compares the exact value against the reference range and
 * feeds the exact value to the pattern rules, because rounding first would flip a result sitting
 * just outside its range into a normal one.
 *
 * The rule mirrors `decimalScale` on the input, which trims a longer decimal tail but never pads a
 * shorter one: 0.60452 at two decimals shows as `0.60`, and 5.44 already at two shows unchanged.
 */
export function formatParamValue(value: number, param: Pick<LabParameter, 'decimals'>): string {
  if (!Number.isFinite(value)) return '';
  if (param.decimals === undefined) return String(value);

  const [, tail = ''] = String(value).split('.');
  return tail.length > param.decimals ? value.toFixed(param.decimals) : String(value);
}

/** The value with its unit, as the deviation cards and the copied summary print it. */
export function formatParamValueWithUnit(
  value: number,
  param: Pick<LabParameter, 'decimals' | 'unit'>,
): string {
  const text = formatParamValue(value, param);
  return param.unit ? `${text} ${param.unit}` : text;
}
