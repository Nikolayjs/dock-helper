import { describe, expect, it } from 'vitest';

import { autofillFromPatient, type PatientFacts } from './patientAutofill';
import type { CalculatorField } from './types';

const FACTS: PatientFacts = {
  ageYears: 68,
  sex: 'female',
  heightCm: 162,
  weightKg: 78.5,
  creatinine: { value: 118, takenAt: '2026-08-26' },
};

const clearance: CalculatorField[] = [
  { key: 'age', label: 'Возраст', type: 'number', unit: 'лет', min: 1, max: 120 },
  { key: 'weight', label: 'Вес', type: 'number', unit: 'кг', min: 1, max: 300 },
  { key: 'creatinine', label: 'Креатинин крови', type: 'number', unit: 'мкмоль/л', min: 1, max: 2000 },
  {
    key: 'sexFactor',
    label: 'Пол',
    type: 'select',
    options: [
      { label: 'Мужской', value: 1.23 },
      { label: 'Женский', value: 1.04 },
    ],
  },
];

describe('заполнение калькулятора из карточки', () => {
  it('раскладывает возраст, вес, креатинин и пол по своим полям', () => {
    expect(autofillFromPatient(clearance, FACTS).map((f) => [f.fieldKey, f.value])).toEqual([
      ['age', 68],
      ['weight', 78.5],
      ['creatinine', 118],
      ['sexFactor', 1.04],
    ]);
  });

  // Пол в калькуляторе — множитель, а не слово: вариант ищется по подписи.
  it('пол мужской берёт свой множитель', () => {
    const filled = autofillFromPatient(clearance, { ...FACTS, sex: 'male' });
    expect(filled.find((f) => f.fieldKey === 'sexFactor')?.value).toBe(1.23);
  });

  // Свой калькулятор врач заводит с любыми ключами, а подписывает по-русски.
  it('находит поля по подписи, когда ключи чужие', () => {
    const own: CalculatorField[] = [
      { key: 'f1', label: 'Вес пациента', type: 'number' },
      { key: 'f2', label: 'Рост', type: 'number' },
    ];
    expect(autofillFromPatient(own, FACTS).map((f) => [f.fieldKey, f.value])).toEqual([
      ['f1', 78.5],
      ['f2', 162],
    ]);
  });

  // Иначе взрослый вес молча ужался бы до детского потолка, а с ним и результат.
  it('значение за границами поля не подставляется вовсе', () => {
    const paediatric: CalculatorField[] = [{ key: 'weight', label: 'Вес ребёнка', type: 'number', min: 1, max: 60 }];
    expect(autofillFromPatient(paediatric, FACTS)).toEqual([]);
  });

  it('чего в карточке нет — не подставляется', () => {
    const empty: PatientFacts = { ageYears: null, sex: null, heightCm: null, weightKg: null, creatinine: null };
    expect(autofillFromPatient(clearance, empty)).toEqual([]);
  });

  it('поля не про пациента не трогаются', () => {
    const bp: CalculatorField[] = [
      { key: 'sbp', label: 'Систолическое АД', type: 'number' },
      { key: 'dbp', label: 'Диастолическое АД', type: 'number' },
    ];
    expect(autofillFromPatient(bp, FACTS)).toEqual([]);
  });

  it('у креатинина рядом со значением едет дата бланка', () => {
    const filled = autofillFromPatient(clearance, FACTS).find((f) => f.fieldKey === 'creatinine');
    expect(filled?.note).toContain('2026');
    expect(filled?.display).toBe('118 мкмоль/л');
  });

  // «Пол 1,04» не сообщает врачу ровно ничего: множитель — не слово.
  it('у списка подставленное называется подписью варианта, а не числом', () => {
    const filled = autofillFromPatient(clearance, FACTS).find((f) => f.fieldKey === 'sexFactor');
    expect(filled?.display).toBe('Женский');
    expect(filled?.value).toBe(1.04);
  });

  it('числа называются по-русски, с запятой и единицей', () => {
    const filled = autofillFromPatient(clearance, FACTS).find((f) => f.fieldKey === 'weight');
    expect(filled?.display).toBe('78,5 кг');
  });
});
