import { describe, expect, it } from 'vitest';

import { withUnit } from './units';

describe('единица при числе', () => {
  // Эти слова уходят в заметку визита, то есть в карту пациента.
  it('склоняет годы', () => {
    expect(withUnit(54, 'лет')).toBe('54 года');
    expect(withUnit(68, 'лет')).toBe('68 лет');
    expect(withUnit(21, 'лет')).toBe('21 год');
    expect(withUnit(11, 'лет')).toBe('11 лет');
  });

  it('остальные единицы оставляет как есть', () => {
    expect(withUnit(78.5, 'кг')).toBe('78,5 кг');
    expect(withUnit(118, 'мкмоль/л')).toBe('118 мкмоль/л');
  });

  it('без единицы — просто число', () => {
    expect(withUnit(1.04)).toBe('1,04');
  });
});
