import { describe, expect, it } from 'vitest';

import { bodyMassIndex, formatAge } from './utils';

describe('индекс массы тела', () => {
  it('считается по росту в сантиметрах и весу в килограммах', () => {
    expect(bodyMassIndex(170, 70)).toBe(24.2);
    expect(bodyMassIndex(162, 78.5)).toBe(29.9);
  });

  // Ноль здесь не «не указано», а невозможный рост: делить на него нечего.
  it('без роста или веса числа не выдумывает', () => {
    expect(bodyMassIndex(null, 70)).toBeNull();
    expect(bodyMassIndex(170, null)).toBeNull();
    expect(bodyMassIndex(0, 70)).toBeNull();
  });
});

describe('возраст словами', () => {
  it('склоняется', () => {
    expect(formatAge(1)).toBe('1 год');
    expect(formatAge(3)).toBe('3 года');
    expect(formatAge(11)).toBe('11 лет');
    expect(formatAge(68)).toBe('68 лет');
  });
});
