import { describe, expect, it } from 'vitest';

import { analyzeTest } from './analyzerEngine';
import {
  describePatternNode,
  hydrateLabTest,
  labTestDraftToPayload,
  toLabTestDefinition,
  type BackendLabTest,
  type PatternNode,
} from './customTypes';

/**
 * Пол отдельным условием правила.
 *
 * Нормы и без того зависят от пола, но норма отвечает на вопрос «нормальное ли это число», а
 * правило — на другой: «относится ли это заключение к этому пациенту». Здесь проверяется, что
 * второй вопрос действительно задаётся и что условие переживает круг «база → редактор → база».
 */
function test(root: PatternNode): BackendLabTest {
  return {
    id: 't1',
    title: 'Тест',
    shortTitle: 'Тест',
    description: '',
    parameters: [
      {
        key: 'ferritin',
        label: 'Ферритин',
        inputType: 'number',
        range: { min: 30, max: 300 },
        lowCauses: [],
        highCauses: [],
      },
    ],
    patterns: [{ id: 'p1', title: 'Дефицит железа', severity: 'warning', causes: [], root }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const LOW_FERRITIN = { ferritin: 10 };

const sexRule = (sex: 'male' | 'female', negate?: true): PatternNode => ({
  type: 'group',
  operator: 'and',
  children: [
    { type: 'condition', paramKey: 'ferritin', status: 'low' },
    negate ? { type: 'sex', sex, negate: true } : { type: 'sex', sex },
  ],
});

describe('условие о поле в правиле', () => {
  it('срабатывает только у своего пола', () => {
    const definition = toLabTestDefinition(test(sexRule('female')));
    expect(analyzeTest(definition, LOW_FERRITIN, 'female').matchedPatterns).toHaveLength(1);
    expect(analyzeTest(definition, LOW_FERRITIN, 'male').matchedPatterns).toHaveLength(0);
  });

  it('с отрицанием — наоборот', () => {
    const definition = toLabTestDefinition(test(sexRule('female', true)));
    expect(analyzeTest(definition, LOW_FERRITIN, 'male').matchedPatterns).toHaveLength(1);
    expect(analyzeTest(definition, LOW_FERRITIN, 'female').matchedPatterns).toHaveLength(0);
  });

  it('не подменяет собой условие о показателе: без отклонения правило молчит', () => {
    const definition = toLabTestDefinition(test(sexRule('female')));
    expect(analyzeTest(definition, { ferritin: 100 }, 'female').matchedPatterns).toHaveLength(0);
  });

  it('одно условие о поле на весь корень тоже работает', () => {
    const definition = toLabTestDefinition(test({ type: 'sex', sex: 'male' }));
    expect(analyzeTest(definition, LOW_FERRITIN, 'male').matchedPatterns).toHaveLength(1);
    expect(analyzeTest(definition, LOW_FERRITIN, 'female').matchedPatterns).toHaveLength(0);
  });
});

describe('круг «база → редактор → база»', () => {
  it('смешанное правило остаётся редактируемым, а не запирается', () => {
    const draft = hydrateLabTest(test(sexRule('female')));
    const rule = draft.patterns[0];
    expect(rule.locked).toBeFalsy();
    expect(rule.conditions.map((c) => c.kind)).toEqual(['param', 'sex']);
  });

  it('условие о поле возвращается в базу тем же узлом', () => {
    const payload = labTestDraftToPayload(hydrateLabTest(test(sexRule('female'))));
    expect(payload.patterns[0].root).toEqual({
      type: 'group',
      operator: 'and',
      children: [
        { type: 'condition', paramKey: 'ferritin', status: 'low' },
        { type: 'sex', sex: 'female' },
      ],
    });
  });

  it('отрицание переживает круг', () => {
    const payload = labTestDraftToPayload(hydrateLabTest(test(sexRule('male', true))));
    const children = (payload.patterns[0].root as Extract<PatternNode, { type: 'group' }>).children;
    expect(children[1]).toEqual({ type: 'sex', sex: 'male', negate: true });
  });
});

describe('описание условия словами', () => {
  it('называет пол, а не ключ показателя', () => {
    expect(describePatternNode(sexRule('female'), () => 'Ферритин')).toBe('Ферритин ниже нормы И пол женский');
    expect(describePatternNode({ type: 'sex', sex: 'male', negate: true }, () => '')).toBe('НЕ (пол мужской)');
  });
});
