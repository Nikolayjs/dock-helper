import { describe, expect, it } from 'vitest';

import type { LabTestDefinition } from '../analyzer/types';
import { interpretResult, resultValueMap } from './interpret';
import type { LabResult } from './types';

const test: LabTestDefinition = {
  id: 'cbc',
  title: 'Общий анализ крови',
  shortTitle: 'ОАК',
  description: '',
  parameters: [
    {
      key: 'hgb',
      label: 'Гемоглобин',
      unit: 'г/л',
      inputType: 'number',
      range: { male: { min: 130, max: 170 }, female: { min: 120, max: 150 } },
    },
  ],
  patterns: [],
};

const result: LabResult = {
  id: 'r1',
  patientId: 'p1',
  analyzerId: 'cbc',
  analyzerTitle: 'Общий анализ крови',
  takenAt: '2026-02-10',
  sex: 'male',
  ageYears: 40,
  values: [{ key: 'hgb', label: 'Гемоглобин', unit: 'г/л', value: 118 }],
  note: '',
  createdAt: '2026-02-11T09:00:00.000Z',
  updatedAt: '2026-02-11T09:00:00.000Z',
};

describe('толкование сохранённого бланка', () => {
  it('считается по сегодняшнему анализатору', () => {
    const { analysis } = interpretResult(result, [test]);
    expect(analysis?.deviations.map((d) => d.status)).toEqual(['low']);
  });

  // Пол и возраст — часть того, как бланк был прочитан: в карточке они могли с тех пор измениться.
  it('берёт пол и возраст из самой записи', () => {
    const { analysis } = interpretResult({ ...result, sex: 'female' }, [test]);
    expect(analysis?.deviations.map((d) => d.status)).toEqual(['low']);
    const { analysis: forWoman } = interpretResult({ ...result, sex: 'female', values: [{ key: 'hgb', label: 'Гемоглобин', value: 125 }] }, [test]);
    expect(forWoman?.deviations).toEqual([]);
  });

  // Числа никуда не делись, а судить их нечем — и притворяться, что всё в норме, нельзя.
  it('удалённый анализатор оставляет запись без толкования, а не без значений', () => {
    expect(interpretResult(result, [])).toEqual({});
    expect(resultValueMap(result)).toEqual({ hgb: 118 });
  });
});
