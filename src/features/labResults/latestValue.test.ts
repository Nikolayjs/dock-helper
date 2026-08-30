import { describe, expect, it } from 'vitest';

import { CREATININE, latestValueByName } from './latestValue';
import type { LabResult } from './types';

const result = (id: string, takenAt: string, values: LabResult['values']): LabResult => ({
  id,
  patientId: 'p1',
  analyzerId: 'bio',
  analyzerTitle: 'Биохимия',
  takenAt,
  sex: 'female',
  ageYears: 68,
  values,
  note: '',
  createdAt: `${takenAt}T10:00:00.000Z`,
  updatedAt: `${takenAt}T10:00:00.000Z`,
});

describe('последнее значение показателя', () => {
  it('берёт самый свежий бланк, а не первый попавшийся', () => {
    const results = [
      result('r1', '2026-01-10', [{ key: 'creatinine', label: 'Креатинин', unit: 'мкмоль/л', value: 78 }]),
      result('r2', '2026-06-10', [{ key: 'creatinine', label: 'Креатинин', unit: 'мкмоль/л', value: 96 }]),
    ];
    expect(latestValueByName(results, CREATININE)).toMatchObject({ value: 96, takenAt: '2026-06-10', resultId: 'r2' });
  });

  // Ключ принадлежит анализатору, а анализатор врач заводит свой, с любыми ключами.
  it('находит по названию, даже когда ключ чужой', () => {
    const results = [result('r1', '2026-06-10', [{ key: 'kr', label: 'Креатинин крови', unit: 'мкмоль/л', value: 88 }])];
    expect(latestValueByName(results, CREATININE)?.value).toBe(88);
  });

  it('дата едет вместе со значением', () => {
    const results = [result('r1', '2026-06-10', [{ key: 'creatinine', label: 'Креатинин', value: 88 }])];
    expect(latestValueByName(results, CREATININE)?.takenAt).toBe('2026-06-10');
  });

  it('чужие показатели не подходят', () => {
    const results = [result('r1', '2026-06-10', [{ key: 'urea', label: 'Мочевина', value: 6 }])];
    expect(latestValueByName(results, CREATININE)).toBeUndefined();
  });

  it('при одной дате выигрывает записанный позже', () => {
    const early = result('r1', '2026-06-10', [{ key: 'creatinine', label: 'Креатинин', value: 70 }]);
    const late = { ...result('r2', '2026-06-10', [{ key: 'creatinine', label: 'Креатинин', value: 90 }]), createdAt: '2026-06-11T10:00:00.000Z' };
    expect(latestValueByName([early, late], CREATININE)?.value).toBe(90);
    expect(latestValueByName([late, early], CREATININE)?.value).toBe(90);
  });
});
