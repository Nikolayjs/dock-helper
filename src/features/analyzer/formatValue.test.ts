import { describe, expect, it } from 'vitest';

import { formatParamValue, formatParamValueWithUnit } from './formatValue';

describe('formatParamValue', () => {
  // The defect: a computed absolute count showed as 0.12 in its field and 0.12446 in the
  // deviation card beside it.
  it('trims a decimal tail longer than the parameter allows', () => {
    expect(formatParamValue(0.12446, { decimals: 2 })).toBe('0.12');
    expect(formatParamValue(5.72516, { decimals: 2 })).toBe('5.73');
    expect(formatParamValue(8.89, { decimals: 1 })).toBe('8.9');
  });

  it('leaves a value that already fits, including its trailing zero', () => {
    expect(formatParamValue(5.44, { decimals: 2 })).toBe('5.44');
    expect(formatParamValue(2.5, { decimals: 2 })).toBe('2.5');
    expect(formatParamValue(317, { decimals: 2 })).toBe('317');
  });

  it('prints the number untouched when the parameter sets no precision', () => {
    expect(formatParamValue(0.12446, {})).toBe('0.12446');
    expect(formatParamValue(166, {})).toBe('166');
  });

  it('renders nothing for a value that is not a number', () => {
    expect(formatParamValue(Number.NaN, { decimals: 2 })).toBe('');
    expect(formatParamValue(Number.POSITIVE_INFINITY, { decimals: 2 })).toBe('');
  });
});

describe('formatParamValueWithUnit', () => {
  it('appends the unit when there is one', () => {
    expect(formatParamValueWithUnit(0.12446, { decimals: 2, unit: '×10⁹/л' })).toBe('0.12 ×10⁹/л');
    expect(formatParamValueWithUnit(2, { unit: 'мм/ч' })).toBe('2 мм/ч');
  });

  it('omits it when there is not', () => {
    expect(formatParamValueWithUnit(7.4, {})).toBe('7.4');
  });
});
