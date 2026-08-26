import { describe, expect, it } from 'vitest';

import { conversionFactor, convertValue, normalizeUnit } from './units';

describe('normalizeUnit', () => {
  it('reduces the three ways of writing a power of ten to one', () => {
    expect(normalizeUnit('×10⁹/л')).toBe(normalizeUnit('10^9/л'));
    expect(normalizeUnit('10*9/л')).toBe(normalizeUnit('×10⁹/л'));
    expect(normalizeUnit('×10¹²/л')).toBe('1012/л');
  });

  it('ignores case, spacing and ё', () => {
    expect(normalizeUnit(' Ед/Л ')).toBe(normalizeUnit('ед/л'));
  });
});

describe('conversionFactor', () => {
  it('accepts the same unit written differently', () => {
    expect(conversionFactor('×10⁹/л', '10^9/л')).toBe(1);
  });

  // The defect: Инвитро prints тыс/мкл and млн/мкл, the analyzers hold ×10⁹/л and ×10¹²/л. The
  // numbers coincide, which is why the fields simply stayed empty instead of showing something wrong.
  it('treats the American cell-count convention as the same unit', () => {
    expect(conversionFactor('тыс/мкл', '×10⁹/л')).toBe(1);
    expect(conversionFactor('млн/мкл', '×10¹²/л')).toBe(1);
    expect(conversionFactor('10³/мкл', '×10⁹/л')).toBe(1);
  });

  it('rescales mass concentration, in both directions', () => {
    expect(conversionFactor('г/дл', 'г/л')).toBe(10);
    expect(conversionFactor('г/л', 'г/дл')).toBe(0.1);
  });

  it('refuses units that measure different things', () => {
    expect(conversionFactor('%', '×10⁹/л')).toBeNull();
    expect(conversionFactor('×10¹²/л', 'в п/зр')).toBeNull();
    // Counts per litre at two different powers are not interchangeable either.
    expect(conversionFactor('×10⁹/л', '×10¹²/л')).toBeNull();
  });

  // Deliberate: мг/дл → ммоль/л needs the analyte's molar mass. Guessing one factor would put a
  // plausible wrong number in front of a doctor, which is worse than the empty field it replaces.
  it('does not attempt molar conversions', () => {
    expect(conversionFactor('мг/дл', 'ммоль/л')).toBeNull();
    expect(conversionFactor('мг/дл', 'мкмоль/л')).toBeNull();
  });

  it('leaves an unknown unit comparable only to itself', () => {
    expect(conversionFactor('мм/ч', 'мм/ч')).toBe(1);
    expect(conversionFactor('мм/ч', 'г/л')).toBeNull();
  });
});

describe('convertValue', () => {
  it('is exact where a naive multiplication is not', () => {
    // 16.6 * 10 is 166.00000000000003 in binary floating point.
    expect(convertValue(16.6, 10)).toBe(166);
    expect(convertValue(32.8, 10)).toBe(328);
  });

  it('leaves the value alone when the factor is one', () => {
    expect(convertValue(5.44, 1)).toBe(5.44);
  });
});
