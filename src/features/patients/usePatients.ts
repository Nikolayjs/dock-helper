import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Patient, PatientVisit } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['patients'];

export type PatientInput = Pick<Patient, 'fullName' | 'sex' | 'birthDate' | 'phone' | 'reminderDate' | 'reminderNote'>;
export type VisitInput = Pick<PatientVisit, 'date' | 'diagnosis' | 'diagnosisCode' | 'note' | 'referralCategory' | 'referralDestination'>;

const resource = createCrudResource<Patient, PatientInput>('/patients', QUERY_KEY);

export interface ImportResult {
  created: number;
  skipped: string[];
  dispensaryCreated: number;
  dispensarySkipped: number;
}

/** Строка импорта может заодно открыть карту диспансерного учёта — тем же запросом. */
export interface ImportPatientRow extends PatientInput {
  dispensary?: { diagnosis: string; diagnosisCode?: string; registeredDate: string };
}

/** Один запрос на весь список: ограничитель — 20 запросов в минуту, а реестр длиннее. */
function importPatients(patients: ImportPatientRow[]): Promise<ImportResult> {
  return request<ImportResult>('/patients/import', { method: 'POST', body: JSON.stringify({ patients }) });
}

function addVisit(patientId: string, input: VisitInput): Promise<PatientVisit> {
  return request<PatientVisit>(`/patients/${patientId}/visits`, { method: 'POST', body: JSON.stringify(input) });
}

function updateVisit(patientId: string, visitId: string, input: VisitInput): Promise<PatientVisit> {
  return request<PatientVisit>(`/patients/${patientId}/visits/${visitId}`, { method: 'PATCH', body: JSON.stringify(input) });
}

function deleteVisit(patientId: string, visitId: string): Promise<void> {
  return request<void>(`/patients/${patientId}/visits/${visitId}`, { method: 'DELETE' });
}

export function usePatients() {
  const { items, isLoading, error, refetch, invalidate, create, update, remove } = useCrudResource(resource);

  return {
    patients: items,
    isLoading,
    error,
    refetch,
    addPatient: create,
    updatePatient: update,
    deletePatient: remove,
    // Визиты живут внутри пациента: своя ручка на сервере, но тот же список на экране.
    importPatients: useInvalidatingMutation(invalidate, importPatients),
    addVisit: useInvalidatingMutation(invalidate, addVisit),
    updateVisit: useInvalidatingMutation(invalidate, updateVisit),
    deleteVisit: useInvalidatingMutation(invalidate, deleteVisit),
  };
}
