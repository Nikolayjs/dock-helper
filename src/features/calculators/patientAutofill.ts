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

/**
 * Поле, которое **должно** было заполниться из карточки, но не смогло.
 *
 * Такое поле очищается, а не остаётся со значением по умолчанию, и это исправленная ошибка, а не
 * придирка. У пациента, которому креатинин никто не сдавал, калькулятор клиренса показывал
 * заводские «88 мкмоль/л» и **считал по ним результат** — 67 мл/мин, «незначительное снижение», — а
 * над этим стояла плашка «заполнено из карточки». То есть приложение выдавало клиническое число,
 * взявшееся ниоткуда, и предлагало записать его в визит.
 */
export interface MissingField {
  fieldKey: string;
  label: string;
  /** `absent` — в карточке этого нет; `outOfRange` — есть, но не годится этому калькулятору. */
  reason: 'absent' | 'outOfRange';
  /** Для `outOfRange`: что именно не подошло. */
  note?: string;
}

export interface Autofill {
  filled: FilledField[];
  missing: MissingField[];
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
 * Ровно поэтому наружу отдаётся и **список незаполненного**: поле, которое должно было приехать из
 * карточки и не приехало, страница очищает. Оставленное заводское значение — то же самое молчаливое
 * подставление, только хуже: оно выглядит как взятое из карты.
 *
 * Значение, не попавшее в границы поля, тоже считается незаполненным: детская доза с потолком 60 кг
 * при взрослом весе 96 кг иначе молча ужалась бы до потолка, а с ней и результат.
 */
export function autofillFromPatient(fields: CalculatorField[], facts: PatientFacts): Autofill {
  const filled: FilledField[] = [];
  const missing: MissingField[] = [];

  for (const field of fields) {
    const key = normalise(field.key);
    const label = normalise(field.label);
    const matcher = MATCHERS.find((candidate) => candidate.test(key, label));
    // Поле не про пациента (АД, частота дыхания) — его значение по умолчанию остаётся как было.
    if (!matcher) continue;

    if (matcher.fact === 'sex') {
      // Пол в калькуляторе — это множитель, а не слово: подходящий вариант ищется по подписи.
      const wanted = facts.sex === 'male' ? MALE_OPTION : facts.sex === 'female' ? FEMALE_OPTION : null;
      const option = wanted && field.type === 'select'
        ? field.options?.find((candidate) => wanted.test(normalise(candidate.label)))
        : undefined;
      if (!option) {
        missing.push({ fieldKey: field.key, label: field.label, reason: 'absent' });
        continue;
      }
      filled.push({ fieldKey: field.key, label: field.label, value: option.value, display: option.label });
      continue;
    }

    const fact = facts[matcher.fact];
    const value = typeof fact === 'number' ? fact : fact && typeof fact === 'object' ? fact.value : null;
    if (value === null || !Number.isFinite(value)) {
      missing.push({ fieldKey: field.key, label: field.label, reason: 'absent' });
      continue;
    }
    if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
      missing.push({
        fieldKey: field.key,
        label: field.label,
        reason: 'outOfRange',
        note: `в карточке ${withUnit(value, field.unit)}, калькулятор принимает ${withUnit(field.min ?? 0, field.unit)}–${withUnit(field.max ?? 0, field.unit)}`,
      });
      continue;
    }

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

  return { filled, missing };
}
