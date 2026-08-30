import { describe, expect, it } from 'vitest';

import type { LabParameter } from '../analyzer/types';
import { dynamicsOptions, dynamicsSeries, latestRange } from './dynamics';
import type { LabResult } from './types';

function result(partial: Partial<LabResult> & Pick<LabResult, 'id' | 'takenAt' | 'values'>): LabResult {
  return {
    patientId: 'p1',
    analyzerId: 'a1',
    analyzerTitle: 'Общий анализ крови',
    sex: 'male',
    ageYears: 40,
    note: '',
    createdAt: `${partial.takenAt}T10:00:00.000Z`,
    updatedAt: `${partial.takenAt}T10:00:00.000Z`,
    ...partial,
  };
}

const hgb: LabParameter = {
  key: 'hgb',
  label: 'Гемоглобин',
  unit: 'г/л',
  inputType: 'number',
  range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } },
};

describe('какие показатели попадают в динамику', () => {
  it('одна точка динамикой не считается', () => {
    const results = [
      result({ id: 'r1', takenAt: '2026-01-10', values: [{ key: 'hgb', label: 'Гемоглобин', value: 140 }] }),
      result({ id: 'r2', takenAt: '2026-02-10', values: [{ key: 'wbc', label: 'Лейкоциты', value: 6 }] }),
    ];
    expect(dynamicsOptions(results).map((o) => o.key)).toEqual([]);
  });

  it('показатель из двух бланков предлагается и знает их число', () => {
    const results = [
      result({ id: 'r1', takenAt: '2026-01-10', values: [{ key: 'hgb', label: 'Гемоглобин', value: 140 }] }),
      result({ id: 'r2', takenAt: '2026-02-10', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
    ];
    expect(dynamicsOptions(results)).toEqual([{ key: 'hgb', label: 'Гемоглобин', unit: undefined, count: 2 }]);
  });

  // Показатель могли переименовать, и врач ищет его по сегодняшнему слову.
  it('название берётся из самого свежего бланка', () => {
    const results = [
      result({ id: 'r1', takenAt: '2026-01-10', values: [{ key: 'hgb', label: 'Hb', value: 140 }] }),
      result({ id: 'r2', takenAt: '2026-02-10', values: [{ key: 'hgb', label: 'Гемоглобин', unit: 'г/л', value: 128 }] }),
    ];
    expect(dynamicsOptions(results)[0]).toMatchObject({ label: 'Гемоглобин', unit: 'г/л' });
  });
});

describe('ряд значений', () => {
  const results = [
    result({ id: 'r2', takenAt: '2026-02-10', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
    result({ id: 'r1', takenAt: '2026-01-10', values: [{ key: 'hgb', label: 'Гемоглобин', value: 140 }] }),
    result({ id: 'r3', takenAt: '2026-03-10', values: [{ key: 'wbc', label: 'Лейкоциты', value: 6 }] }),
  ];

  // Список бланков идёт свежими вверх, а график читается слева направо во времени.
  it('идёт по возрастанию даты, а бланки без показателя выпадают', () => {
    expect(dynamicsSeries(results, 'hgb', hgb).map((p) => [p.date, p.value])).toEqual([
      ['2026-01-10', 140],
      ['2026-02-10', 128],
    ]);
  });

  it('отклонение считается по норме своего бланка, а не общей', () => {
    // Один и тот же гемоглобин 128: у мужчины он ниже нормы, у женщины — в норме.
    const mixed = [
      result({ id: 'm', takenAt: '2026-01-10', sex: 'male', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
      result({ id: 'f', takenAt: '2026-02-10', sex: 'female', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
    ];
    expect(dynamicsSeries(mixed, 'hgb', hgb).map((p) => p.status)).toEqual(['low', 'normal']);
  });

  // Числа никуда не делись, а нормы, по которой их судить, больше нет.
  it('без показателя в сегодняшнем анализаторе точки остаются, а отклонения нет', () => {
    const points = dynamicsSeries(results, 'hgb', undefined);
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.status === null)).toBe(true);
  });

  it('показатель без нормы не объявляется нормальным', () => {
    const noRange: LabParameter = { key: 'hgb', label: 'Гемоглобин', inputType: 'number', range: {} };
    expect(dynamicsSeries(results, 'hgb', noRange).every((p) => p.status === null)).toBe(true);
  });

  // Полоса на графике — про то, куда показатель идёт сейчас.
  it('полоса нормы берётся из самой поздней точки', () => {
    const growing = [
      result({ id: 'k', takenAt: '2026-01-10', sex: 'female', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
      result({ id: 'a', takenAt: '2026-02-10', sex: 'male', values: [{ key: 'hgb', label: 'Гемоглобин', value: 128 }] }),
    ];
    expect(latestRange(dynamicsSeries(growing, 'hgb', hgb))).toEqual({ min: 130, max: 170 });
  });

  it('пустой ряд не притворяется, что норма известна', () => {
    expect(latestRange([])).toEqual({});
  });
});
