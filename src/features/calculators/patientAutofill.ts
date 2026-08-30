import dayjs from 'dayjs';

import type { CalculatorField } from './types';
import { withUnit } from './units';

/** Что известно о пациенте к моменту расчёта. */
export interface PatientFacts {
  ageYears: number | null;
  sex: 'male' | 'female' | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Последний креатинин из сохранённых бланков — вместе с датой бланка. */
  creatinine: { value: number; takenAt: string } | null;
}

export interface FilledField {
  fieldKey: string;
  /** Как поле называется в калькуляторе — этим именем подстановка и называется врачу. */
  label: string;
  value: number;
  /**
   * Подставленное **словами**: «78,5 кг», «Женский».
   *
   * У списка это подпись варианта, а не его число: пол в калькуляторе Кокрофта — Голта хранится
   * множителем `1.04`, и строка «пол 1.04» не сообщает врачу ровно ничего.
   */
  display: string;
  /** Откуда взято, если не из самой карточки: у креатинина — дата бланка. */
  note?: string;
}

const normalise = (text: string) => text.toLowerCase().replace(/ё/g, 'е').trim();

/**
 * Какое поле калькулятора чем заполняется.
 *
 * Сверяется и ключ, и подпись: заводские калькуляторы зовут поля `weight` и `age`, а свой врач
 * заводит с любыми ключами и подписывает по-русски. Совпадение по подписи — единственное, что
 * работает на обоих.
 */
const MATCHERS: { fact: keyof PatientFacts; test: (key: string, label: string) => boolean }[] = [
  { fact: 'ageYears', test: (key, label) => key === 'age' || /^возраст/.test(label) },
  { fact: 'weightKg', test: (key, label) => key === 'weight' || /^вес|^масса тела/.test(label) },
  { fact: 'heightCm', test: (key, label) => key === 'height' || /^рост/.test(label) },
  { fact: 'creatinine', test: (key, label) => /creatinin/.test(key) || /креатинин/.test(label) },
  { fact: 'sex', test: (key, label) => /^sex/.test(key) || label === 'пол' || /^пол\b/.test(label) },
];

const MALE_OPTION = /^м|^муж/;
const FEMALE_OPTION = /^ж|^жен/;

/**
 * Значения из карточки пациента, разложенные по полям калькулятора.
 *
 * Всё подставленное **называется вслух** — страница показывает список того, что заполнено и откуда.
 * Молча подставленное число здесь опаснее, чем в анализаторе: калькулятор считает дозу, и врач,
 * не знающий, что вес приехал из карточки, не проверит, когда его измеряли.
 *
 * Значение, не попавшее в границы поля, **не подставляется вовсе**: детская доза с потолком 100 кг
 * при взрослом весе 110 кг иначе молча ужалась бы до сотни, а с ней и результат.
 */
export function autofillFromPatient(fields: CalculatorField[], facts: PatientFacts): FilledField[] {
  const filled: FilledField[] = [];

  for (const field of fields) {
    const key = normalise(field.key);
    const label = normalise(field.label);
    const matcher = MATCHERS.find((candidate) => candidate.test(key, label));
    if (!matcher) continue;

    if (matcher.fact === 'sex') {
      // Пол в калькуляторе — это множитель, а не слово: подходящий вариант ищется по подписи.
      if (!facts.sex || field.type !== 'select') continue;
      const wanted = facts.sex === 'male' ? MALE_OPTION : FEMALE_OPTION;
      const option = field.options?.find((candidate) => wanted.test(normalise(candidate.label)));
      if (!option) continue;
      filled.push({ fieldKey: field.key, label: field.label, value: option.value, display: option.label });
      continue;
    }

    const fact = facts[matcher.fact];
    const value = typeof fact === 'number' ? fact : fact && typeof fact === 'object' ? fact.value : null;
    if (value === null || !Number.isFinite(value)) continue;
    if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) continue;

    filled.push({
      fieldKey: field.key,
      label: field.label,
      value,
      display: withUnit(value, field.unit),
      note:
        matcher.fact === 'creatinine' && facts.creatinine
          ? `бланк от ${dayjs(facts.creatinine.takenAt).format('D MMM YYYY')}`
          : undefined,
    });
  }

  return filled;
}
