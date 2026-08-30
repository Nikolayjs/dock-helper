import { describe, expect, it } from 'vitest';

import { appendToNote, calculationSummary } from './resultLine';
import type { CalculatorDefinition } from './types';

const clearance: CalculatorDefinition = {
  id: 'creatinine-clearance',
  title: 'Клиренс креатинина',
  description: '',
  category: 'Нефрология',
  fields: [
    { key: 'age', label: 'Возраст', type: 'number', unit: 'лет' },
    { key: 'weight', label: 'Вес', type: 'number', unit: 'кг' },
    { key: 'creatinine', label: 'Креатинин крови', type: 'number', unit: 'мкмоль/л' },
    {
      key: 'sexFactor',
      label: 'Пол',
      type: 'select',
      options: [
        { label: 'Мужской', value: 1.23 },
        { label: 'Женский', value: 1.04 },
      ],
    },
  ],
  formula: '((140 - age) * weight * sexFactor) / creatinine',
  resultLabel: 'Клиренс креатинина',
  resultUnit: 'мл/мин',
  decimals: 0,
};

const values = { age: 68, weight: 78.5, creatinine: 118, sexFactor: 1.04 };

describe('строка о расчёте', () => {
  // «Клиренс 62» через полгода не проверить ничем — исходные значения и делают запись записью.
  it('несёт результат вместе с исходными значениями', () => {
    expect(calculationSummary(clearance, values, 49.6)).toBe(
      'Клиренс креатинина: 50 мл/мин (возраст 68 лет, вес 78,5 кг, креатинин крови 118 мкмоль/л, пол женский).',
    );
  });

  it('толкование становится частью записи', () => {
    const line = calculationSummary(clearance, values, 49.6, { id: 'moderate', label: 'Умеренное снижение', color: 'orange' });
    expect(line).toContain('50 мл/мин — Умеренное снижение');
  });

  // Множитель 1,04 в заметке визита не значит ничего.
  it('у списка печатается подпись варианта, а не его число', () => {
    expect(calculationSummary(clearance, values, 50)).not.toContain('1,04');
  });

  it('незаполненные поля в запись не идут', () => {
    const line = calculationSummary(clearance, { ...values, creatinine: '' }, 50);
    // Само название калькулятора со словом «креатинин» остаётся — проверяем список исходных.
    expect(line).not.toContain('креатинин крови');
    expect(line).toContain('вес 78,5 кг');
  });
});

describe('дописывание в заметку визита', () => {
  it('не затирает написанное', () => {
    expect(appendToNote('АД 150/95.', 'ИМТ: 29,9.')).toBe('АД 150/95.\nИМТ: 29,9.');
  });

  it('в пустую заметку ложится строкой без пустой строки сверху', () => {
    expect(appendToNote('', 'ИМТ: 29,9.')).toBe('ИМТ: 29,9.');
    expect(appendToNote('   ', 'ИМТ: 29,9.')).toBe('ИМТ: 29,9.');
  });
});
