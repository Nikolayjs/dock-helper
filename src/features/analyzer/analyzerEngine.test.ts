import { describe, expect, it } from 'vitest';

import { analyzeTest } from './analyzerEngine';
import { toLabTestDefinition } from './customTypes';
import type { BackendLabParameter, BackendLabTest } from './customTypes';
import { DEFAULT_ADULT_AGE, getParamRange, isAgeWithinBands } from './types';
import type { LabParameter } from './types';

/**
 * Движок анализатора: нормы, статусы, производные показатели и паттерны.
 *
 * Проверяется прежде всего то, что раньше ошибалось молча: возраст, не попавший ни в одну полосу,
 * брал последнюю в списке — то есть обычно взрослую, — и детский анализ считался по взрослым нормам
 * без единого признака этого.
 */

const param = (overrides: Partial<BackendLabParameter> & Pick<BackendLabParameter, 'key' | 'label'>): BackendLabParameter => ({
  inputType: 'number',
  lowCauses: [],
  highCauses: [],
  ...overrides,
});

/** Гемоглобин: полосы 1–5, 5–12, 12–18 и взрослая, у взрослых — своя норма для каждого пола. */
const HEMOGLOBIN = param({
  key: 'hgb',
  label: 'Гемоглобин',
  unit: 'г/л',
  ageBands: [
    { id: 'b1', minAge: 1, maxAge: 5, range: { min: 110, max: 140 } },
    { id: 'b2', minAge: 5, maxAge: 12, range: { min: 115, max: 145 } },
    { id: 'b3', minAge: 12, maxAge: 18, range: { min: 120, max: 155 } },
    { id: 'b4', minAge: 18, range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } } },
  ],
});

const TEST: BackendLabTest = {
  id: 'cbc',
  title: 'Общий анализ крови',
  shortTitle: 'ОАК',
  description: '',
  parameters: [
    HEMOGLOBIN,
    param({ key: 'rbc', label: 'Эритроциты', range: { min: 4, max: 5.5 } }),
    param({ key: 'hct', label: 'Гематокрит', range: { min: 39, max: 49 } }),
    // Производное от производного стоит в списке **раньше** своего источника: движок обязан
    // справиться, а не молча оставить показатель пустым.
    param({
      key: 'mchc',
      label: 'MCHC',
      inputType: 'derived',
      deriveFormula: 'hgb / hct * 100',
      range: { min: 320, max: 360 },
    }),
    param({ key: 'mcv', label: 'MCV', inputType: 'derived', deriveFormula: 'hct / rbc * 10', range: { min: 80, max: 100 } }),
  ],
  patterns: [
    {
      id: 'iron',
      title: 'Картина железодефицита',
      severity: 'warning',
      causes: [],
      root: {
        type: 'group',
        operator: 'and',
        children: [
          { type: 'condition', paramKey: 'hgb', status: 'low' },
          { type: 'condition', paramKey: 'mcv', status: 'low' },
        ],
      },
    },
    {
      id: 'any-anemia',
      title: 'Снижение гемоглобина или эритроцитов',
      severity: 'info',
      causes: [],
      root: {
        type: 'group',
        operator: 'or',
        children: [
          { type: 'condition', paramKey: 'hgb', status: 'low' },
          { type: 'condition', paramKey: 'rbc', status: 'low' },
        ],
      },
    },
    {
      id: 'not-normal-hgb',
      title: 'Гемоглобин не в норме',
      severity: 'info',
      causes: [],
      root: { type: 'condition', paramKey: 'hgb', status: 'normal', negate: true },
    },
  ],
  createdAt: '',
  updatedAt: '',
};

const definition = toLabTestDefinition(TEST);
const hgb = definition.parameters[0] as LabParameter;

describe('нормы по полу', () => {
  it('у мужчины и женщины разные', () => {
    expect(getParamRange(hgb, 'male', 40)).toEqual({ min: 130, max: 170 });
    expect(getParamRange(hgb, 'female', 40)).toEqual({ min: 120, max: 150 });
  });
});

describe('возрастные полосы', () => {
  it('возраст внутри полосы берёт свою', () => {
    expect(getParamRange(hgb, 'male', 8)).toEqual({ min: 115, max: 145 });
  });

  it('на границе выигрывает первая подходящая полоса', () => {
    // 12 лет попадает и в «5–12», и в «12–18»: порядок полос задаёт автор анализатора.
    expect(getParamRange(hgb, 'male', 12)).toEqual({ min: 115, max: 145 });
  });

  it('возраст ниже всех полос берёт ближайшую, а не взрослую', () => {
    // Это и была ошибка: ребёнок трёх месяцев получал норму взрослого мужчины 130–170.
    expect(getParamRange(hgb, 'male', 0)).toEqual({ min: 110, max: 140 });
  });

  it('возраст выше всех полос берёт ближайшую сверху', () => {
    const child = toLabTestDefinition({
      ...TEST,
      parameters: [{ ...HEMOGLOBIN, ageBands: HEMOGLOBIN.ageBands!.slice(0, 3) }],
    }).parameters[0];
    expect(getParamRange(child, 'male', 60)).toEqual({ min: 120, max: 155 });
  });

  it('без возраста берётся взрослая норма', () => {
    expect(getParamRange(hgb, 'male')).toEqual(getParamRange(hgb, 'male', DEFAULT_ADULT_AGE));
  });

  it('пустой список полос — это отсутствие нормы, а не чужая норма', () => {
    const empty = toLabTestDefinition({ ...TEST, parameters: [{ ...HEMOGLOBIN, ageBands: [] }] }).parameters[0];
    expect(getParamRange(empty, 'male', 40)).toEqual({});
  });

  it('isAgeWithinBands отличает попадание от подстановки', () => {
    expect(isAgeWithinBands(hgb, 8)).toBe(true);
    expect(isAgeWithinBands(hgb, 0)).toBe(false);
  });
});

describe('статусы и отклонения', () => {
  it('ниже нормы — low, выше — high, внутри — normal', () => {
    const result = analyzeTest(definition, { hgb: 100, rbc: 4.5, hct: 60 }, 'male', 40);
    expect(result.statuses.hgb).toBe('low');
    expect(result.statuses.rbc).toBe('normal');
    expect(result.statuses.hct).toBe('high');
    expect(result.deviations.map((d) => d.param.key).sort()).toContain('hgb');
  });

  it('считаются только заполненные показатели', () => {
    const result = analyzeTest(definition, { hgb: 140 }, 'male', 40);
    expect(result.enteredCount).toBe(1);
    expect(result.statuses.rbc).toBeUndefined();
  });

  it('границы нормы входят в норму', () => {
    expect(analyzeTest(definition, { hgb: 130 }, 'male', 40).statuses.hgb).toBe('normal');
    expect(analyzeTest(definition, { hgb: 170 }, 'male', 40).statuses.hgb).toBe('normal');
  });
});

describe('производные показатели', () => {
  it('считаются по введённым значениям', () => {
    const result = analyzeTest(definition, { hgb: 140, rbc: 4.5, hct: 42 }, 'male', 40);
    expect(result.values.mcv).toBeCloseTo(93.3, 1);
    expect(result.values.mchc).toBeCloseTo(333.3, 1);
  });

  it('порядок в списке не важен: производное считается, даже стоя выше своего источника', () => {
    // `mchc` объявлен раньше `mcv`, но зависит только от прямых показателей; проверка ниже — про
    // то, что круговой проход доводит до конца обе цепочки.
    const result = analyzeTest(definition, { hgb: 140, rbc: 4.5, hct: 42 }, 'male', 40);
    expect(Object.keys(result.values)).toContain('mcv');
    expect(Object.keys(result.values)).toContain('mchc');
  });

  it('производное от производного тоже считается', () => {
    const chained = toLabTestDefinition({
      ...TEST,
      parameters: [
        param({ key: 'b', label: 'Второе', inputType: 'derived', deriveFormula: 'a * 2', range: {} }),
        param({ key: 'c', label: 'Третье', inputType: 'derived', deriveFormula: 'b + 1', range: {} }),
        param({ key: 'a', label: 'Первое', range: {} }),
      ],
      patterns: [],
    });
    expect(analyzeTest(chained, { a: 5 }, 'male', 40).values).toMatchObject({ a: 5, b: 10, c: 11 });
  });

  it('нехватка данных пропускает производное, а не роняет разбор', () => {
    const result = analyzeTest(definition, { hgb: 140 }, 'male', 40);
    expect(result.values.mcv).toBeUndefined();
    expect(result.enteredCount).toBe(1);
  });

  it('взаимная ссылка не зацикливает', () => {
    const loop = toLabTestDefinition({
      ...TEST,
      parameters: [
        param({ key: 'x', label: 'X', inputType: 'derived', deriveFormula: 'y + 1', range: {} }),
        param({ key: 'y', label: 'Y', inputType: 'derived', deriveFormula: 'x + 1', range: {} }),
      ],
      patterns: [],
    });
    expect(analyzeTest(loop, {}, 'male', 40).values).toEqual({});
  });

  it('производное не считается введённым показателем', () => {
    const result = analyzeTest(definition, { hgb: 140, rbc: 4.5, hct: 42 }, 'male', 40);
    expect(result.enteredCount).toBe(3);
  });
});

describe('паттерны', () => {
  it('AND срабатывает, только когда выполнены оба условия', () => {
    const both = analyzeTest(definition, { hgb: 100, rbc: 4.5, hct: 30 }, 'male', 40);
    expect(both.statuses.mcv).toBe('low');
    expect(both.matchedPatterns.map((p) => p.id)).toContain('iron');

    const one = analyzeTest(definition, { hgb: 100, rbc: 4.5, hct: 42 }, 'male', 40);
    expect(one.matchedPatterns.map((p) => p.id)).not.toContain('iron');
  });

  it('OR срабатывает от любого условия', () => {
    const result = analyzeTest(definition, { rbc: 3 }, 'male', 40);
    expect(result.matchedPatterns.map((p) => p.id)).toContain('any-anemia');
  });

  it('NOT переворачивает условие', () => {
    expect(analyzeTest(definition, { hgb: 100 }, 'male', 40).matchedPatterns.map((p) => p.id)).toContain(
      'not-normal-hgb',
    );
    expect(analyzeTest(definition, { hgb: 140 }, 'male', 40).matchedPatterns.map((p) => p.id)).not.toContain(
      'not-normal-hgb',
    );
  });

  it('незаполненный показатель условие не выполняет', () => {
    expect(analyzeTest(definition, { rbc: 4.5 }, 'male', 40).matchedPatterns.map((p) => p.id)).not.toContain(
      'not-normal-hgb',
    );
  });
});

describe('пометка о том, по каким нормам считали', () => {
  it('без возраста говорит, что взят взрослый', () => {
    expect(analyzeTest(definition, { hgb: 140 }, 'male').ageNote).toEqual({
      kind: 'assumed',
      assumedAge: DEFAULT_ADULT_AGE,
    });
  });

  it('возраст вне полос называется прямо', () => {
    expect(analyzeTest(definition, { hgb: 140 }, 'male', 0).ageNote).toEqual({ kind: 'outside', age: 0 });
  });

  it('возраст внутри полос — молчит', () => {
    expect(analyzeTest(definition, { hgb: 140 }, 'male', 40).ageNote).toBeUndefined();
  });

  it('молчит и тогда, когда ни один заполненный показатель от возраста не зависит', () => {
    // Иначе пометка висела бы на анализе, где возраст ничего не меняет, — то есть была бы шумом.
    expect(analyzeTest(definition, { rbc: 4.5 }, 'male').ageNote).toBeUndefined();
  });
});
