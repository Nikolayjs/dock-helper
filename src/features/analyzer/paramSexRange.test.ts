import { describe, expect, it } from 'vitest';

import { analyzeTest } from './analyzerEngine';
import { hydrateLabTest, labTestDraftToPayload, toLabTestDefinition, type BackendLabTest, type BackendLabParameter } from './customTypes';

/**
 * Норма, зависящая от пола, — в конструкторе, а не только в базе.
 *
 * Раньше такой показатель открывался в конструкторе замком «не редактируется» и проезжал через
 * сохранение нетронутым. Здесь проверяется, что круг «база → редактор → база» ничего не теряет во
 * всех четырёх сочетаниях: общая норма, норма по полу, возрастные диапазоны и то и другое вместе.
 */
function testWith(param: Partial<BackendLabParameter>): BackendLabTest {
  return {
    id: 't1',
    title: 'Тест',
    shortTitle: 'Тест',
    description: '',
    parameters: [
      { key: 'hgb', label: 'Гемоглобин', inputType: 'number', lowCauses: [], highCauses: [], ...param },
    ],
    patterns: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const roundTrip = (param: Partial<BackendLabParameter>) =>
  labTestDraftToPayload(hydrateLabTest(testWith(param))).parameters[0];

describe('норма по полу в конструкторе', () => {
  it('общая норма остаётся общей, тумблер выключен', () => {
    const draft = hydrateLabTest(testWith({ range: { min: 1, max: 2 } })).parameters[0];
    expect(draft.bySex).toBeFalsy();
    expect({ min: draft.min, max: draft.max }).toEqual({ min: 1, max: 2 });
    expect(roundTrip({ range: { min: 1, max: 2 } }).range).toEqual({ min: 1, max: 2 });
  });

  it('норма по полу открывается редактируемой, а не замком', () => {
    const range = { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } };
    const draft = hydrateLabTest(testWith({ range })).parameters[0];
    expect(draft.bySex).toBe(true);
    expect(draft.male).toEqual({ min: 130, max: 170 });
    expect(draft.female).toEqual({ min: 120, max: 150 });
    expect(roundTrip({ range }).range).toEqual(range);
  });

  it('возрастные диапазоны с полом переживают круг', () => {
    const ageBands = [
      { id: 'b1', maxAge: 12, range: { male: { min: 110, max: 140 }, female: { min: 110, max: 140 } } },
      { id: 'b2', minAge: 13, range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } } },
    ];
    const draft = hydrateLabTest(testWith({ ageBands })).parameters[0];
    expect(draft.bySex).toBe(true);
    expect(draft.ageBands?.[1].female).toEqual({ min: 120, max: 150 });
    expect(roundTrip({ ageBands }).ageBands).toEqual(ageBands);
  });

  it('диапазоны вразнобой сводятся к одному виду без потери смысла', () => {
    // Часть диапазонов с полом, часть без: тумблер один на показатель, поэтому общая норма
    // раскладывается в одинаковую мужскую и женскую — это то же самое правило, записанное иначе.
    const mixed = roundTrip({
      ageBands: [
        { id: 'b1', maxAge: 12, range: { min: 110, max: 140 } },
        { id: 'b2', minAge: 13, range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } } },
      ],
    });
    expect(mixed.ageBands?.[0].range).toEqual({ male: { min: 110, max: 140 }, female: { min: 110, max: 140 } });
    expect(mixed.ageBands?.[1].range).toEqual({ male: { min: 130, max: 170 }, female: { min: 120, max: 150 } });
  });
});

describe('движок читает такую норму по-разному для мужчины и женщины', () => {
  const definition = toLabTestDefinition(
    testWith({ range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } } }),
  );

  it('125 — норма у женщины и понижено у мужчины', () => {
    expect(analyzeTest(definition, { hgb: 125 }, 'female').deviations).toHaveLength(0);
    expect(analyzeTest(definition, { hgb: 125 }, 'male').deviations[0].status).toBe('low');
  });

  it('160 — норма у мужчины и повышено у женщины', () => {
    expect(analyzeTest(definition, { hgb: 160 }, 'male').deviations).toHaveLength(0);
    expect(analyzeTest(definition, { hgb: 160 }, 'female').deviations[0].status).toBe('high');
  });
});
