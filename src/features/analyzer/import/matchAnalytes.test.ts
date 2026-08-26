import { describe, expect, it } from 'vitest';

import type { LabParameter, LabTestDefinition } from '../types';
import { matchAnalytes } from './matchAnalytes';
import { parseLabValues } from './parseLabValues';
import { defaultSelection } from './selectFills';

function param(partial: Partial<LabParameter> & Pick<LabParameter, 'key' | 'label'>): LabParameter {
  return { inputType: 'number', range: {}, ...partial };
}

function test(id: string, title: string, parameters: LabParameter[]): LabTestDefinition {
  return { id, title, shortTitle: title, description: '', parameters, patterns: [] };
}

/** The parameters of the seeded ОАК that this file's rows can reach, with their real units. */
const CBC = test('cbc', 'Общий анализ крови', [
  param({ key: 'hemoglobin', label: 'Гемоглобин', unit: 'г/л' }),
  param({ key: 'erythrocytes', label: 'Эритроциты', unit: '×10¹²/л' }),
  param({ key: 'hematocrit', label: 'Гематокрит', unit: '%' }),
  param({ key: 'mcv', label: 'MCV (средний объём эритроцита)', unit: 'фл' }),
  param({ key: 'mch', label: 'MCH (среднее содержание Hb в эритроците)', unit: 'пг' }),
  param({ key: 'mchc', label: 'Средняя концентрация Hb в эритроците (MCHC)', unit: 'г/л' }),
  param({ key: 'rdwCv', label: 'Ширина распределения эритроцитов, CV (RDW-CV)', aliases: ['RDW'], unit: '%' }),
  param({ key: 'rdwSd', label: 'Ширина распределения эритроцитов, SD (RDW-SD)', aliases: ['RDW'], unit: 'фл' }),
  param({ key: 'platelets', label: 'Тромбоциты', unit: '×10⁹/л' }),
  param({ key: 'leukocytes', label: 'Лейкоциты', unit: '×10⁹/л' }),
  param({ key: 'neutrophils', label: 'Нейтрофилы', unit: '%' }),
  param({ key: 'lymphocytes', label: 'Лимфоциты', unit: '%' }),
  param({ key: 'monocytes', label: 'Моноциты', unit: '%' }),
  param({ key: 'eosinophils', label: 'Эозинофилы', unit: '%' }),
  param({ key: 'basophils', label: 'Базофилы', unit: '%' }),
  param({ key: 'esr', label: 'СОЭ', unit: 'мм/ч' }),
  param({ key: 'neutrophilsAbsolute', label: 'Нейтрофилы, абсолютное число', unit: '×10⁹/л', inputType: 'derived' }),
  param({ key: 'lymphocytesAbsolute', label: 'Лимфоциты, абсолютное число', unit: '×10⁹/л', inputType: 'derived' }),
  param({ key: 'monocytesAbsolute', label: 'Моноциты, абсолютное число', unit: '×10⁹/л', inputType: 'derived' }),
  param({ key: 'eosinophilsAbsolute', label: 'Эозинофилы, абсолютное число', unit: '×10⁹/л', inputType: 'derived' }),
  param({ key: 'basophilsAbsolute', label: 'Базофилы, абсолютное число', unit: '×10⁹/л', inputType: 'derived' }),
]);

/** The two urinalysis dipstick pads that a blood count can reach by name alone. */
const URINALYSIS = test('urine', 'Общий анализ мочи', [
  param({
    key: 'bloodReaction',
    label: 'Эритроциты (реакция на гемоглобин)',
    aliases: ['BLD', 'Кровь', 'Гемоглобин', 'Скрытая кровь'],
    inputType: 'select',
    options: [
      { label: 'Не обнаружено', value: 0 },
      { label: 'Обнаружено', value: 1 },
    ],
  }),
  param({
    key: 'leukocyteEsterase',
    label: 'Лейкоциты (реакция на эстеразу)',
    aliases: ['LEU', 'Эстераза лейкоцитов'],
    inputType: 'select',
    options: [
      { label: 'Не обнаружено', value: 0 },
      { label: 'Обнаружено', value: 1 },
    ],
  }),
  param({ key: 'erythrocytesSediment', label: 'Эритроциты в осадке', unit: 'в п/зр' }),
]);

/** A clinical blood count exactly as Инвитро prints it: American units throughout. */
const INVITRO_CBC = [
  'Гематокрит 50.6* % 39 - 49',
  'Гемоглобин 16.6 г/дл 13.2 - 17.3',
  'Эритроциты 5.44 млн/мкл 4.3 - 5.7',
  'MCV (ср. объем эритр.) 93.1 фл 80 - 99',
  'RDW (шир. распред. эритр) 14.3 % 11.6 - 14.8',
  'MCH (ср. содер. Hb в эр.) 30.5 пг 27 - 34',
  'МСHС (ср. конц. Hb в эр.) 32.8 г/дл 32 - 37',
  'Тромбоциты 317 тыс/мкл 150 - 400',
  'Лейкоциты 8.89 тыс/мкл 4.5 - 11',
  'Нейтрофилы (общ.число), % 64.4 % 48 - 78',
  'Лимфоциты, % 22.9 % 19 - 37',
  'Моноциты, % 6.8 % 3 - 11',
  'Эозинофилы, % 4.5 % 1 - 5',
  'Базофилы, % 1.4* % < 1.0',
  'Нейтрофилы, абс. 5.73* тыс/мкл 1.78 - 5.38',
  'Лимфоциты, абс. 2.04 тыс/мкл 1.32 - 3.57',
  'Моноциты, абс. 0.60 тыс/мкл 0.2 - 0.95',
  'Эозинофилы, абс. 0.40 тыс/мкл < 0.7',
  'Базофилы, абс. 0.12 тыс/мкл < 0.2',
  'СОЭ 2 мм/ч < 15',
];

function planFor(lines: string[], tests: LabTestDefinition[]) {
  return matchAnalytes(parseLabValues(lines), tests);
}

function filled(lines: string[], tests: LabTestDefinition[]) {
  const plan = planFor(lines, tests);
  const byTest: Record<string, Record<string, number>> = {};
  for (const fill of plan.fills) {
    byTest[fill.test.id] = Object.fromEntries(fill.matches.map((m) => [m.param.key, m.value]));
  }
  return { plan, byTest };
}

describe('matchAnalytes, лабораторные единицы', () => {
  it('fills every directly entered parameter of an Инвитро ОАК', () => {
    const { byTest } = filled(INVITRO_CBC, [CBC, URINALYSIS]);

    expect(byTest.cbc).toEqual({
      hemoglobin: 166, // из 16.6 г/дл
      erythrocytes: 5.44, // млн/мкл читается как ×10¹²/л
      hematocrit: 50.6,
      mcv: 93.1,
      mch: 30.5,
      mchc: 328, // из 32.8 г/дл
      rdwCv: 14.3, // «RDW» в процентах — это CV, не SD
      platelets: 317,
      leukocytes: 8.89,
      neutrophils: 64.4,
      lymphocytes: 22.9,
      monocytes: 6.8,
      eosinophils: 4.5,
      basophils: 1.4,
      esr: 2,
    });
  });

  it('records the rescaling it did, and only where it did any', () => {
    const { plan } = filled(INVITRO_CBC, [CBC]);
    const converted = plan.fills[0].matches.filter((m) => m.conversion);

    expect(converted.map((m) => [m.param.key, m.analyte.value, m.value])).toEqual([
      ['hemoglobin', 16.6, 166],
      ['mchc', 32.8, 328],
    ]);
    expect(converted[0].conversion).toEqual({ from: 'г/дл', to: 'г/л' });
  });

  // `RDW` alone names either variant; the unit is what separates them.
  it('sends RDW in фл to the SD parameter instead', () => {
    const { byTest } = filled(['RDW (шир. распред. эритр) 42.1 фл 35 - 56'], [CBC]);
    expect(byTest.cbc).toEqual({ rdwSd: 42.1 });
  });

  it('lists rows the form computes apart from rows it did not recognise', () => {
    const { plan } = filled(INVITRO_CBC, [CBC]);

    expect(plan.derived.map((a) => a.name)).toEqual([
      'Нейтрофилы, абс',
      'Лимфоциты, абс',
      'Моноциты, абс',
      'Эозинофилы, абс',
      'Базофилы, абс',
    ]);
    expect(plan.unmatched).toEqual([]);
  });

  it('keeps a blood count out of the urinalysis dipstick pads', () => {
    const { byTest } = filled(INVITRO_CBC, [CBC, URINALYSIS]);
    // `Гемоглобин` is an alias of the blood pad and the pad states no unit, so nothing but the
    // parameter's own options stands between a haemoglobin of 16.6 and a urine result.
    expect(byTest.urine).toBeUndefined();
  });

  it('still lets a urine result reach the pad it belongs to', () => {
    const { byTest } = filled(
      ['Гемоглобин отриц', 'Лейкоциты отриц', 'Эритроциты в осадке 1 в п/зр 0 - 2'],
      [CBC, URINALYSIS],
    );
    expect(byTest.urine).toEqual({ bloodReaction: 0, leukocyteEsterase: 0, erythrocytesSediment: 1 });
  });

  it('does not put an erythrocyte count into the urine sediment field', () => {
    const { byTest } = filled(['Эритроциты 5.44 млн/мкл 4.3 - 5.7'], [CBC, URINALYSIS]);
    expect(byTest.cbc).toEqual({ erythrocytes: 5.44 });
    expect(byTest.urine).toBeUndefined();
  });
});

describe('defaultSelection', () => {
  // `Гемоглобин отриц` and `Лейкоциты отриц` off a urinalysis form also name parameters of the blood
  // count, and by name alone nothing tells the two apart. Proportion does: one file is one specimen.
  it('leaves the analyzer a urine form merely brushed against unticked', () => {
    const plan = planFor(
      ['Гемоглобин отриц', 'Лейкоциты отриц', 'Эритроциты в осадке 1 в п/зр 0 - 2'],
      [CBC, URINALYSIS],
    );
    expect(defaultSelection(plan)).toEqual(['urine']);
  });

  it('ticks only the blood count for a blood count', () => {
    expect(defaultSelection(planFor(INVITRO_CBC, [CBC, URINALYSIS]))).toEqual(['cbc']);
  });

  it('falls back to the strongest candidate when nothing clears the bar', () => {
    const plan = planFor(['Гематокрит 50.6 % 39 - 49', 'СОЭ 2 мм/ч < 15'], [CBC, URINALYSIS]);
    expect(defaultSelection(plan)).toEqual(['cbc']);
  });
});
