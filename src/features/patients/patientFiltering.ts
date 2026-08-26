import type { Patient } from './types';
import { calcAge, getReminderStatus } from './utils';

/**
 * Narrowing the patient list by the questions a doctor actually asks it.
 *
 * Search already answers «где этот пациент». These answer the other kind of question — «кого я ещё
 * не видел», «кому просрочено напоминание», «сколько у меня детей на участке» — which search cannot,
 * because the answer is a property of the record rather than a word in it.
 *
 * Kept to four, all with an «Все» default, so the filter row reads at a glance and an empty result
 * is always explainable by something visible on screen.
 */

export type SexFilter = 'all' | 'male' | 'female';
export type AgeFilter = 'all' | 'child' | 'adult' | 'senior';
export type VisitsFilter = 'all' | 'with' | 'without';
export type ReminderFilter = 'all' | 'any' | 'overdue';

export interface PatientFilterState {
  sex: SexFilter;
  age: AgeFilter;
  visits: VisitsFilter;
  reminder: ReminderFilter;
}

export const EMPTY_PATIENT_FILTERS: PatientFilterState = {
  sex: 'all',
  age: 'all',
  visits: 'all',
  reminder: 'all',
};

/** Age bands as a clinic thinks of them, not as round decades. */
const AGE_BANDS: Record<Exclude<AgeFilter, 'all'>, (age: number) => boolean> = {
  child: (age) => age < 18,
  adult: (age) => age >= 18 && age < 60,
  senior: (age) => age >= 60,
};

export function countActiveFilters(filters: PatientFilterState): number {
  return Object.values(filters).filter((value) => value !== 'all').length;
}

export function matchesPatientFilters(patient: Patient, filters: PatientFilterState): boolean {
  if (filters.sex !== 'all' && patient.sex !== filters.sex) return false;

  if (filters.age !== 'all') {
    const age = calcAge(patient.birthDate);
    // An unknown birth date cannot satisfy an age band; guessing either way would be a lie.
    if (age === null || !AGE_BANDS[filters.age](age)) return false;
  }

  if (filters.visits === 'with' && patient.visits.length === 0) return false;
  if (filters.visits === 'without' && patient.visits.length > 0) return false;

  if (filters.reminder !== 'all') {
    if (!patient.reminderDate) return false;
    if (filters.reminder === 'overdue' && getReminderStatus(patient.reminderDate) !== 'overdue') return false;
  }

  return true;
}
