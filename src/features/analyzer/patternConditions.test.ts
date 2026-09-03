import { describe, expect, it } from 'vitest';

import { hydrateLabTest, labTestDraftToPayload, toLabTestDefinition } from './customTypes';
import type { BackendLabTest, PatternNode } from './customTypes';
import type { ParamStatus, Sex } from './types';

/**
 * Условия правил: набор состояний, сравнение с числом и возраст.
 *
 * Проверяется **результат вычисления**, а не форма дерева: конструктор вправе перестроить дерево
 * (свёрнутая `or`-группа становится одним условием с набором), и сравнение по форме объявляло бы
 * ошибкой ровно то, ради чего всё затевалось. Смысл правила — это то, на каких анализах оно
 * срабатывает.
 */

const param = (key: string, label: string, unit?: string) => ({
  key,
  label,
  unit,
  inputType: 'number' as const,
  range: { min: 4, max: 9 },
  lowCauses: [],
  highCauses: [],
});

function test(root: PatternNode): BackendLabTest {
  return {
    id: 't',
    title: 'Тест',
    shortTitle: 'Т',
    description: '',
    createdAt: '',
    updatedAt: '',
    parameters: [param('wbc', 'Лейкоциты', '10⁹/л'), param('lym', 'Лимфоциты'), param('neu', 'Нейтрофилы')],
    patterns: [{ id: 'r', title: 'Заключение', severity: 'info', causes: [], root }],
  };
}

/** Срабатывает ли правило на таком наборе состояний, значений и пациенте. */
function fires(
  root: PatternNode,
  statuses: Record<string, ParamStatus>,
  values: Record<string, number> = {},
  patient: { sex: Sex; age?: number } = { sex: 'male' },
): boolean {
  const definition = toLabTestDefinition(test(root));
  return definition.patterns[0].match(statuses, values, patient);
}

describe('набор состояний в одном условии', () => {
  const root: PatternNode = { type: 'condition', paramKey: 'wbc', status: 'high', statuses: ['high', 'normal'] };

  it('срабатывает на каждом из перечисленных', () => {
    expect(fires(root, { wbc: 'high' })).toBe(true);
    expect(fires(root, { wbc: 'normal' })).toBe(true);
  });

  it('не срабатывает на остальных', () => {
    expect(fires(root, { wbc: 'low' })).toBe(false);
  });

  /* Отсутствие значения — не состояние, и вывод о нём был бы выводом ни из чего. */
  it('не срабатывает, когда показателя в анализе нет', () => {
    expect(fires(root, {})).toBe(false);
  });

  describe('с отрицанием', () => {
    const negated: PatternNode = { ...root, negate: true } as PatternNode;

    it('срабатывает ровно на том, чего нет в наборе', () => {
      expect(fires(negated, { wbc: 'low' })).toBe(true);
      expect(fires(negated, { wbc: 'high' })).toBe(false);
      expect(fires(negated, { wbc: 'normal' })).toBe(false);
    });

    it('на отсутствующем показателе не срабатывает тоже', () => {
      expect(fires(negated, {})).toBe(false);
    });
  });

  it('старая запись без набора читается как одно состояние', () => {
    const legacy: PatternNode = { type: 'condition', paramKey: 'wbc', status: 'high' };
    expect(fires(legacy, { wbc: 'high' })).toBe(true);
    expect(fires(legacy, { wbc: 'normal' })).toBe(false);
  });
});

describe('сворачивание or-группы в набор состояний', () => {
  /** Ровно то, что было на скриншоте: «(Лейкоциты выше ИЛИ в норме) И Лимфоциты выше И НЕ Нейтрофилы выше». */
  const screenshot: PatternNode = {
    type: 'group',
    operator: 'and',
    children: [
      {
        type: 'group',
        operator: 'or',
        children: [
          { type: 'condition', paramKey: 'wbc', status: 'high' },
          { type: 'condition', paramKey: 'wbc', status: 'normal' },
        ],
      },
      { type: 'condition', paramKey: 'lym', status: 'high' },
      { type: 'condition', paramKey: 'neu', status: 'high', negate: true },
    ],
  };

  it('правило со скриншота открывается в конструкторе целиком, а не под замком', () => {
    const draft = hydrateLabTest(test(screenshot));
    const rule = draft.patterns[0];
    expect(rule.locked).toBeUndefined();
    expect(rule.operator).toBe('and');
    expect(rule.conditions).toHaveLength(3);
    expect(rule.conditions[0]).toMatchObject({ kind: 'param', paramKey: 'wbc', statuses: ['high', 'normal'] });
    expect(rule.conditions[2]).toMatchObject({ kind: 'param', paramKey: 'neu', negate: true });
  });

  it('после сохранения смысл тот же — сверяется вычислением, а не формой дерева', () => {
    const saved = labTestDraftToPayload(hydrateLabTest(test(screenshot))).patterns[0].root;

    const cases: Record<string, ParamStatus>[] = [
      { wbc: 'high', lym: 'high', neu: 'normal' },
      { wbc: 'normal', lym: 'high', neu: 'low' },
      { wbc: 'low', lym: 'high', neu: 'normal' },
      { wbc: 'high', lym: 'normal', neu: 'normal' },
      { wbc: 'high', lym: 'high', neu: 'high' },
      { lym: 'high', neu: 'normal' },
      {},
    ];
    for (const statuses of cases) {
      expect({ statuses, fired: fires(saved, statuses) }).toEqual({ statuses, fired: fires(screenshot, statuses) });
    }
  });

  it('группа по разным показателям остаётся деревом под замком', () => {
    const mixed: PatternNode = {
      type: 'group',
      operator: 'and',
      children: [
        {
          type: 'group',
          operator: 'or',
          children: [
            { type: 'condition', paramKey: 'wbc', status: 'high' },
            { type: 'condition', paramKey: 'lym', status: 'high' },
          ],
        },
      ],
    };
    expect(hydrateLabTest(test(mixed)).patterns[0].locked).toBe(true);
  });

  it('группа с отрицанием внутри тоже остаётся под замком: «не A или не A» — это не набор', () => {
    const negatedInside: PatternNode = {
      type: 'group',
      operator: 'and',
      children: [
        {
          type: 'group',
          operator: 'or',
          children: [
            { type: 'condition', paramKey: 'wbc', status: 'high', negate: true },
            { type: 'condition', paramKey: 'wbc', status: 'normal' },
          ],
        },
      ],
    };
    expect(hydrateLabTest(test(negatedInside)).patterns[0].locked).toBe(true);
  });

  it('and-группа по одному показателю не сворачивается: это другое условие', () => {
    const conjunction: PatternNode = {
      type: 'group',
      operator: 'and',
      children: [
        {
          type: 'group',
          operator: 'and',
          children: [
            { type: 'condition', paramKey: 'wbc', status: 'high' },
            { type: 'condition', paramKey: 'wbc', status: 'normal' },
          ],
        },
      ],
    };
    expect(hydrateLabTest(test(conjunction)).patterns[0].locked).toBe(true);
  });

  it('сохранённое одиночное состояние остаётся без набора — старая сборка прочитает его как раньше', () => {
    const single: PatternNode = { type: 'condition', paramKey: 'wbc', status: 'high' };
    const saved = labTestDraftToPayload(hydrateLabTest(test(single))).patterns[0].root;
    const leaf = (saved as { children: PatternNode[] }).children[0] as { status: string; statuses?: string[] };
    expect(leaf.status).toBe('high');
    expect(leaf.statuses).toBeUndefined();
  });

  it('в наборе `status` заполнен первым — старая сборка покажет правило, а не упадёт', () => {
    const draft = hydrateLabTest(test(screenshot));
    const saved = labTestDraftToPayload(draft).patterns[0].root;
    const leaf = (saved as { children: PatternNode[] }).children[0] as { status: string; statuses?: string[] };
    expect(leaf.status).toBe('high');
    expect(leaf.statuses).toEqual(['high', 'normal']);
  });
});

describe('сравнение показателя с числом', () => {
  const gte: PatternNode = { type: 'value', paramKey: 'wbc', op: 'gte', value: 15 };
  const gt: PatternNode = { type: 'value', paramKey: 'wbc', op: 'gt', value: 15 };

  it('на равном значении «не меньше» срабатывает, а «больше» — нет', () => {
    expect(fires(gte, { wbc: 'high' }, { wbc: 15 })).toBe(true);
    expect(fires(gt, { wbc: 'high' }, { wbc: 15 })).toBe(false);
  });

  it('обе границы считаются по числу, а не по состоянию', () => {
    expect(fires(gte, { wbc: 'normal' }, { wbc: 20 })).toBe(true);
    expect(fires(gte, { wbc: 'high' }, { wbc: 14.9 })).toBe(false);
  });

  it.each([
    ['lte' as const, 4, true],
    ['lte' as const, 5, false],
    ['lt' as const, 3.9, true],
    ['lt' as const, 4, false],
  ])('оператор %s на значении %s', (op, value, expected) => {
    expect(fires({ type: 'value', paramKey: 'wbc', op, value: 4 }, {}, { wbc: value })).toBe(expected);
  });

  it('показателя нет в анализе — ложно, включая отрицание', () => {
    expect(fires(gte, {}, {})).toBe(false);
    expect(fires({ ...gte, negate: true } as PatternNode, {}, {})).toBe(false);
  });

  /* Бесконечность даёт производный показатель с делением на ноль: сравнивать её нечем. */
  it('нечисловое значение — ложно', () => {
    expect(fires(gte, {}, { wbc: Number.POSITIVE_INFINITY })).toBe(false);
    expect(fires(gte, {}, { wbc: Number.NaN })).toBe(false);
  });

  it('отрицание переворачивает сравнение, когда значение есть', () => {
    expect(fires({ ...gte, negate: true } as PatternNode, {}, { wbc: 10 })).toBe(true);
    expect(fires({ ...gte, negate: true } as PatternNode, {}, { wbc: 20 })).toBe(false);
  });
});

describe('условие по возрасту', () => {
  const older: PatternNode = { type: 'age', op: 'gte', value: 60 };

  it('сравнивает возраст пациента', () => {
    expect(fires(older, {}, {}, { sex: 'male', age: 60 })).toBe(true);
    expect(fires(older, {}, {}, { sex: 'male', age: 59 })).toBe(false);
  });

  /*
   * Нормам возраст, которого нет, подменяется тридцатью годами — и результат честно об этом
   * говорит. Правилу подменять нельзя: заключение делалось бы из ничего.
   */
  it.each(['gte', 'lte', 'gt', 'lt'] as const)('без возраста ложно при операторе %s', (op) => {
    expect(fires({ type: 'age', op, value: 60 }, {}, {}, { sex: 'male' })).toBe(false);
  });

  it('без возраста ложно и с отрицанием', () => {
    expect(fires({ ...older, negate: true } as PatternNode, {}, {}, { sex: 'male' })).toBe(false);
  });

  it('с отрицанием и известным возрастом работает как обычно', () => {
    expect(fires({ ...older, negate: true } as PatternNode, {}, {}, { sex: 'male', age: 30 })).toBe(true);
  });
});

describe('правило «лейкоциты ≥ 15 и возраст ≥ 60»', () => {
  const root: PatternNode = {
    type: 'group',
    operator: 'and',
    children: [
      { type: 'value', paramKey: 'wbc', op: 'gte', value: 15 },
      { type: 'age', op: 'gte', value: 60 },
    ],
  };

  it('срабатывает только когда сходятся оба', () => {
    expect(fires(root, {}, { wbc: 18 }, { sex: 'male', age: 70 })).toBe(true);
    expect(fires(root, {}, { wbc: 10 }, { sex: 'male', age: 70 })).toBe(false);
    expect(fires(root, {}, { wbc: 18 }, { sex: 'male', age: 40 })).toBe(false);
    expect(fires(root, {}, { wbc: 18 }, { sex: 'male' })).toBe(false);
  });

  it('открывается в конструкторе и переживает сохранение', () => {
    const draft = hydrateLabTest(test(root));
    expect(draft.patterns[0].locked).toBeUndefined();
    expect(draft.patterns[0].conditions).toMatchObject([
      { kind: 'value', paramKey: 'wbc', op: 'gte', value: 15 },
      { kind: 'age', op: 'gte', value: 60 },
    ]);

    const saved = labTestDraftToPayload(draft).patterns[0].root;
    expect(fires(saved, {}, { wbc: 18 }, { sex: 'male', age: 70 })).toBe(true);
    expect(fires(saved, {}, { wbc: 18 }, { sex: 'male', age: 40 })).toBe(false);
  });
});
