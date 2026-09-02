import { describe, expect, it } from 'vitest';

import type { PatientVisit } from './types';
import { bodyMassIndex, formatAge, lastVisitOf, sortedVisits } from './utils';

describe('индекс массы тела', () => {
  it('считается по росту в сантиметрах и весу в килограммах', () => {
    expect(bodyMassIndex(170, 70)).toBe(24.2);
    expect(bodyMassIndex(162, 78.5)).toBe(29.9);
  });

  // Ноль здесь не «не указано», а невозможный рост: делить на него нечего.
  it('без роста или веса числа не выдумывает', () => {
    expect(bodyMassIndex(null, 70)).toBeNull();
    expect(bodyMassIndex(170, null)).toBeNull();
    expect(bodyMassIndex(0, 70)).toBeNull();
  });
});

describe('возраст словами', () => {
  it('склоняется', () => {
    expect(formatAge(1)).toBe('1 год');
    expect(formatAge(3)).toBe('3 года');
    expect(formatAge(11)).toBe('11 лет');
    expect(formatAge(68)).toBe('68 лет');
  });
});

describe('последний приём', () => {
  const visit = (date: string, createdAt: string, diagnosis = ''): PatientVisit => ({
    id: `${date}/${createdAt}`,
    date,
    diagnosis,
    note: '',
    referralCategory: null,
    referralDestination: '',
    createdAt,
  });

  // Порядок массива ничем не гарантирован: демо дописывает новый визит в конец, сервер отдаёт свой.
  it('добавленный сегодня приём становится последним, где бы он ни лежал в массиве', () => {
    const patient = {
      visits: [
        visit('2025-03-14', '2025-03-14T09:00:00.000Z', 'ОРВИ'),
        visit('2026-09-02', '2026-09-02T08:00:00.000Z', 'Гипертония'),
      ],
    };
    expect(lastVisitOf(patient)?.diagnosis).toBe('Гипертония');
  });

  it('два приёма в один день упорядочены по времени записи', () => {
    const patient = {
      visits: [
        visit('2026-09-02', '2026-09-02T11:00:00.000Z', 'второй'),
        visit('2026-09-02', '2026-09-02T08:00:00.000Z', 'первый'),
      ],
    };
    expect(lastVisitOf(patient)?.diagnosis).toBe('второй');
    expect(sortedVisits(patient.visits).map((v) => v.diagnosis)).toEqual(['второй', 'первый']);
  });

  it('без приёмов — «нет», а не падение', () => {
    expect(lastVisitOf({ visits: [] })).toBeUndefined();
  });

  it('исходный массив не переставляется', () => {
    const visits = [visit('2025-01-01', '2025-01-01T00:00:00.000Z'), visit('2026-01-01', '2026-01-01T00:00:00.000Z')];
    sortedVisits(visits);
    expect(visits[0].date).toBe('2025-01-01');
  });
});
