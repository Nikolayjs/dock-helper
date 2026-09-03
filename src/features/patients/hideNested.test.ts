import { describe, expect, it } from 'vitest';

import { hideObservation, hideVisit } from './hideNested';
import { EMPTY_PATIENT_CONSTANTS } from './types';
import type { DispensaryRecord, Patient } from './types';

function patient(id: string, visitIds: string[]): Patient {
  return {
    id,
    fullName: `Пациент ${id}`,
    sex: null,
    birthDate: null,
    phone: '',
    reminderDate: null,
    reminderNote: '',
    ...EMPTY_PATIENT_CONSTANTS,
    visits: visitIds.map((visitId) => ({
      id: visitId,
      date: '2026-01-01',
      diagnosis: '',
      note: '',
      referralCategory: null,
      referralDestination: '',
      createdAt: '2026-01-01T00:00:00',
    })),
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };
}

function record(id: string, observationIds: string[]): DispensaryRecord {
  return {
    id,
    patientId: 'p1',
    diagnosis: '',
    registeredDate: '2026-01-01',
    nextVisitDate: null,
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: observationIds.map((observationId) => ({
      id: observationId,
      date: '2026-01-01',
      outcome: 'unchanged',
      ovl: false,
      sanatorium: false,
      campRest: false,
      note: '',
      createdAt: '2026-01-01T00:00:00',
    })),
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
  };
}

describe('hideVisit', () => {
  const cached = patient('p1', ['v1', 'v2']);

  it('убирает визит из записи пациента', () => {
    const next = hideVisit('v1')(cached) as Patient;
    expect(next.visits.map((v) => v.id)).toEqual(['v2']);
  });

  it('чужие визиты не трогает', () => {
    const next = hideVisit('нет-такого')(cached) as Patient;
    expect(next.visits).toHaveLength(2);
  });

  it('пустой кэш не ломает', () => {
    expect(hideVisit('v1')(undefined)).toBeUndefined();
  });
});

describe('hideObservation', () => {
  const cached = [record('r1', ['o1', 'o2']), record('r2', ['o3'])];

  it('takes the observation out of its own card', () => {
    const next = hideObservation('r1', 'o2')(cached) as DispensaryRecord[];
    expect(next[0].observations.map((o) => o.id)).toEqual(['o1']);
    expect(next[1]).toBe(cached[1]);
  });

  it('is a no-op for an id that is not there', () => {
    const next = hideObservation('r1', 'нет такого')(cached) as DispensaryRecord[];
    expect(next[0].observations.map((o) => o.id)).toEqual(['o1', 'o2']);
  });
});
