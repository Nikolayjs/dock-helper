import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';

import {
  EMPTY_PATIENT_FILTERS,
  countActiveFilters,
  matchesPatientFilters,
  type PatientFilterState,
} from './patientFiltering';
import { EMPTY_PATIENT_CONSTANTS } from './types';
import type { PatientSex, PatientSummary } from './types';

function patient(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    id: 'p1',
    fullName: 'Иванов Иван Иванович',
    sex: 'male' as PatientSex,
    birthDate: dayjs().subtract(40, 'year').format('YYYY-MM-DD'),
    phone: '',
    reminderDate: null,
    reminderNote: '',
    ...EMPTY_PATIENT_CONSTANTS,
    lastVisit: null,
    visitCount: 0,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function withFilters(overrides: Partial<PatientFilterState>): PatientFilterState {
  return { ...EMPTY_PATIENT_FILTERS, ...overrides };
}



describe('matchesPatientFilters', () => {
  it('lets everything through by default', () => {
    expect(matchesPatientFilters(patient({ sex: null, birthDate: null }), EMPTY_PATIENT_FILTERS)).toBe(true);
  });

  it('filters by sex', () => {
    expect(matchesPatientFilters(patient({ sex: 'male' }), withFilters({ sex: 'female' }))).toBe(false);
    expect(matchesPatientFilters(patient({ sex: 'female' }), withFilters({ sex: 'female' }))).toBe(true);
    expect(matchesPatientFilters(patient({ sex: null }), withFilters({ sex: 'male' }))).toBe(false);
  });

  it('filters by age band', () => {
    const child = patient({ birthDate: dayjs().subtract(10, 'year').format('YYYY-MM-DD') });
    const adult = patient({ birthDate: dayjs().subtract(40, 'year').format('YYYY-MM-DD') });
    const senior = patient({ birthDate: dayjs().subtract(70, 'year').format('YYYY-MM-DD') });

    expect(matchesPatientFilters(child, withFilters({ age: 'child' }))).toBe(true);
    expect(matchesPatientFilters(adult, withFilters({ age: 'child' }))).toBe(false);
    expect(matchesPatientFilters(adult, withFilters({ age: 'adult' }))).toBe(true);
    expect(matchesPatientFilters(senior, withFilters({ age: 'senior' }))).toBe(true);
    expect(matchesPatientFilters(senior, withFilters({ age: 'adult' }))).toBe(false);
  });

  // Guessing either way would be a claim the record does not support.
  it('excludes an unknown birth date from every age band', () => {
    const unknown = patient({ birthDate: null });
    for (const age of ['child', 'adult', 'senior'] as const) {
      expect(matchesPatientFilters(unknown, withFilters({ age }))).toBe(false);
    }
    expect(matchesPatientFilters(unknown, EMPTY_PATIENT_FILTERS)).toBe(true);
  });

  it('filters by whether there are visits', () => {
    expect(matchesPatientFilters(patient({ visitCount: 1 }), withFilters({ visits: 'with' }))).toBe(true);
    expect(matchesPatientFilters(patient({ visitCount: 0 }), withFilters({ visits: 'with' }))).toBe(false);
    expect(matchesPatientFilters(patient({ visitCount: 0 }), withFilters({ visits: 'without' }))).toBe(true);
    expect(matchesPatientFilters(patient({ visitCount: 1 }), withFilters({ visits: 'without' }))).toBe(false);
  });

  it('filters by reminder, and separates overdue from merely set', () => {
    const future = patient({ reminderDate: dayjs().add(10, 'day').format('YYYY-MM-DD') });
    const past = patient({ reminderDate: dayjs().subtract(10, 'day').format('YYYY-MM-DD') });
    const none = patient({ reminderDate: null });

    expect(matchesPatientFilters(future, withFilters({ reminder: 'any' }))).toBe(true);
    expect(matchesPatientFilters(none, withFilters({ reminder: 'any' }))).toBe(false);
    expect(matchesPatientFilters(past, withFilters({ reminder: 'overdue' }))).toBe(true);
    expect(matchesPatientFilters(future, withFilters({ reminder: 'overdue' }))).toBe(false);
  });

  it('combines filters', () => {
    const target = patient({
      sex: 'female',
      birthDate: dayjs().subtract(70, 'year').format('YYYY-MM-DD'),
      visitCount: 1,
    });
    expect(matchesPatientFilters(target, withFilters({ sex: 'female', age: 'senior', visits: 'with' }))).toBe(true);
    expect(matchesPatientFilters(target, withFilters({ sex: 'female', age: 'senior', visits: 'without' }))).toBe(false);
  });
});

describe('countActiveFilters', () => {
  it('counts only what is narrowing the list', () => {
    expect(countActiveFilters(EMPTY_PATIENT_FILTERS)).toBe(0);
    expect(countActiveFilters(withFilters({ sex: 'male' }))).toBe(1);
    expect(countActiveFilters(withFilters({ sex: 'male', reminder: 'overdue' }))).toBe(2);
  });
});
