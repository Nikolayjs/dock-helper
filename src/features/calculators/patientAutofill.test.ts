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
    expect(autofillFromPatient(clearance, FACTS).filled.map((f) => [f.fieldKey, f.value])).toEqual([
      ['age', 68],
      ['weight', 78.5],
      ['creatinine', 118],
      ['sexFactor', 1.04],
    ]);
  });

  // Пол в калькуляторе — множитель, а не слово: вариант ищется по подписи.
  it('пол мужской берёт свой множитель', () => {
    const { filled } = autofillFromPatient(clearance, { ...FACTS, sex: 'male' });
    expect(filled.find((f) => f.fieldKey === 'sexFactor')?.value).toBe(1.23);
  });

  // Свой калькулятор врач заводит с любыми ключами, а подписывает по-русски.
  it('находит поля по подписи, когда ключи чужие', () => {
    const own: CalculatorField[] = [
      { key: 'f1', label: 'Вес пациента', type: 'number' },
      { key: 'f2', label: 'Рост', type: 'number' },
    ];
    expect(autofillFromPatient(own, FACTS).filled.map((f) => [f.fieldKey, f.value])).toEqual([
      ['f1', 78.5],
      ['f2', 162],
    ]);
  });

  // Иначе взрослый вес молча ужался бы до детского потолка, а с ним и результат.
  it('значение за границами поля не подставляется вовсе', () => {
    const paediatric: CalculatorField[] = [{ key: 'weight', label: 'Вес ребёнка', type: 'number', min: 1, max: 60 }];
    expect(autofillFromPatient(paediatric, FACTS).filled).toEqual([]);
  });

  it('чего в карточке нет — не подставляется', () => {
    const empty: PatientFacts = { ageYears: null, sex: null, heightCm: null, weightKg: null, creatinine: null };
    expect(autofillFromPatient(clearance, empty).filled).toEqual([]);
  });

  it('поля не про пациента не трогаются', () => {
    const bp: CalculatorField[] = [
      { key: 'sbp', label: 'Систолическое АД', type: 'number' },
      { key: 'dbp', label: 'Диастолическое АД', type: 'number' },
    ];
    expect(autofillFromPatient(bp, FACTS).filled).toEqual([]);
  });

  it('у креатинина рядом со значением едет дата бланка', () => {
    const filled = autofillFromPatient(clearance, FACTS).filled.find((f) => f.fieldKey === 'creatinine');
    expect(filled?.note).toContain('2026');
    expect(filled?.display).toBe('118 мкмоль/л');
  });

  // «Пол 1,04» не сообщает врачу ровно ничего: множитель — не слово.
  it('у списка подставленное называется подписью варианта, а не числом', () => {
    const filled = autofillFromPatient(clearance, FACTS).filled.find((f) => f.fieldKey === 'sexFactor');
    expect(filled?.display).toBe('Женский');
    expect(filled?.value).toBe(1.04);
  });

  it('числа называются по-русски, с запятой и единицей', () => {
    const filled = autofillFromPatient(clearance, FACTS).filled.find((f) => f.fieldKey === 'weight');
    expect(filled?.display).toBe('78,5 кг');
  });
});

/**
 * Незаполненное — половина ответа, и без неё была настоящая ошибка.
 *
 * У пациента, которому креатинин никто не сдавал, калькулятор клиренса показывал заводские
 * «88 мкмоль/л» и считал по ним результат, а над этим стояла плашка «заполнено из карточки».
 */
describe('чего в карточке не нашлось', () => {
  it('называется поимённо, чтобы страница очистила эти поля', () => {
    const noCreatinine = { ...FACTS, creatinine: null };
    const { filled, missing } = autofillFromPatient(clearance, noCreatinine);
    expect(filled.map((f) => f.fieldKey)).toEqual(['age', 'weight', 'sexFactor']);
    expect(missing).toEqual([{ fieldKey: 'creatinine', label: 'Креатинин крови', reason: 'absent' }]);
  });

  it('пустая карточка оставляет незаполненными все поля про пациента', () => {
    const empty: PatientFacts = { ageYears: null, sex: null, heightCm: null, weightKg: null, creatinine: null };
    expect(autofillFromPatient(clearance, empty).missing.map((f) => f.fieldKey)).toEqual([
      'age',
      'weight',
      'creatinine',
      'sexFactor',
    ]);
  });

  // Иначе заводские 20 кг детской дозы посчитались бы за взрослого.
  it('значение за границами поля названо вместе с причиной', () => {
    const paediatric: CalculatorField[] = [{ key: 'weight', label: 'Вес ребёнка', type: 'number', unit: 'кг', min: 1, max: 60 }];
    const { missing } = autofillFromPatient(paediatric, FACTS);
    expect(missing[0]).toMatchObject({ fieldKey: 'weight', reason: 'outOfRange' });
    expect(missing[0].note).toContain('78,5 кг');
    expect(missing[0].note).toContain('1 кг–60 кг');
  });

  // «Принимает 60–0» — это не диапазон, а `field.max ?? 0`, и читается оно как настоящая граница.
  it('поле с одной границей описывается словами, а не нулём вместо второй', () => {
    const onlyMin: CalculatorField[] = [{ key: 'weight', label: 'Вес', type: 'number', unit: 'кг', min: 90 }];
    expect(autofillFromPatient(onlyMin, FACTS).missing[0].note).toContain('не менее 90 кг');

    const onlyMax: CalculatorField[] = [{ key: 'weight', label: 'Вес', type: 'number', unit: 'кг', max: 60 }];
    expect(autofillFromPatient(onlyMax, FACTS).missing[0].note).toContain('не более 60 кг');
  });

  // Поле не про пациента калькулятор заполняет сам, и трогать его незачем.
  it('чужие поля незаполненными не считаются', () => {
    const bp: CalculatorField[] = [{ key: 'sbp', label: 'Систолическое АД', type: 'number' }];
    expect(autofillFromPatient(bp, FACTS).missing).toEqual([]);
  });
});
