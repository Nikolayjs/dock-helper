import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Patient, PatientSummary, PatientVisit, PatientWithVisits, VisitDigest } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['patients'];

/** Визиты всего пространства без текстов приёмов — свой кэш, потому что запрашивают их не все. */
export const VISITS_QUERY_KEY = ['patients', 'visits'];

export type PatientInput = Pick<
  Patient,
  | 'fullName'
  | 'sex'
  | 'birthDate'
  | 'phone'
  | 'reminderDate'
  | 'reminderNote'
  | 'heightCm'
  | 'weightKg'
  | 'measuredAt'
  | 'allergies'
  | 'insurancePolicy'
  | 'district'
  | 'address'
>;
export type VisitInput = Pick<PatientVisit, 'date' | 'diagnosis' | 'diagnosisCode' | 'note' | 'referralCategory' | 'referralDestination'>;

/*
 * Список — сводки, без визитов. Визиты приезжают отдельно и не всем: см. `usePatientsWithVisits`.
 * Правки списка гасят и кэш визитов — новый приём обязан появиться там же, где и в карточке.
 */
const resource = createCrudResource<PatientSummary, PatientInput>('/patients', QUERY_KEY, {
  alsoInvalidate: [VISITS_QUERY_KEY],
});

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

/**
 * Картотека **со** визитами — для экранов, которые считают по всем приёмам сразу.
 *
 * Дашборд, «Мой день», поиск в шапке и отбор картотеки по диагнозу. Сводки и визиты приезжают
 * двумя запросами и склеиваются здесь, поэтому все функции, считающие по `patient.visits`,
 * остались как были.
 *
 * **Текста приёма в этих визитах нет** — он не нужен ни одной из этих функций и весит больше всего
 * остального. Кому нужен текст, берёт запись целиком: `usePatient(id)`.
 */
export function useVisitDigest(enabled = true) {
  const { data = [], isPending } = useQuery({
    queryKey: VISITS_QUERY_KEY,
    queryFn: () => request<VisitDigest[]>('/patients/visits'),
    enabled,
  });
  return { visits: data, isLoading: enabled && isPending };
}

export function usePatientsWithVisits() {
  const { patients: summaries, isLoading: patientsLoading, ...rest } = usePatients();
  const { visits, isLoading: visitsLoading } = useVisitDigest();

  const patients = useMemo<PatientWithVisits[]>(() => {
    const byPatient = new Map<string, PatientVisit[]>();
    for (const visit of visits) {
      const list = byPatient.get(visit.patientId) ?? [];
      // `note` в дайджест не едет; для склейки он подставляется пустым — читать его здесь некому.
      list.push({ ...visit, note: '' });
      byPatient.set(visit.patientId, list);
    }
    return summaries.map((patient) => ({ ...patient, visits: byPatient.get(patient.id) ?? [] }));
  }, [summaries, visits]);

  return { ...rest, patients, isLoading: patientsLoading || visitsLoading };
}

/**
 * Один пациент целиком: визиты с текстами приёмов.
 *
 * Карточка, редактор, печать бланка и запись расчёта в визит — всё, что читает текст приёма или
 * правит его. Список этого больше не отдаёт.
 */
export function usePatient(id: string | undefined) {
  const { data, isPending, error } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => request<Patient>(`/patients/${id}`),
    enabled: Boolean(id),
  });
  return { patient: data ?? null, isLoading: Boolean(id) && isPending, error };
}

/**
 * Визиты одного дня — **с текстами приёмов**.
 *
 * «Мой день» показывает, что записано на сегодняшнем приёме. Строк здесь столько, сколько человек
 * принято за день, поэтому текст тут ничего не весит — в отличие от общего списка визитов.
 */
export function useVisitsOnDate(date: string) {
  const { data = [], isPending } = useQuery({
    queryKey: ['patients', 'visits', 'day', date],
    queryFn: () => request<Array<PatientVisit & { patientId: string }>>(`/patients/visits/day/${date}`),
  });
  return { visits: data, isLoading: isPending };
}

/** Запись пациента прямо сейчас, мимо кэша: перед правкой визита, чтобы не затереть чужую. */
export function fetchPatient(id: string): Promise<Patient> {
  return request<Patient>(`/patients/${id}`);
}

/** Вся картотека с текстами — только для выгрузки: она обещает полную копию и обязана её отдать. */
export function fetchPatientsFull(): Promise<Patient[]> {
  return request<Patient[]>('/patients/full');
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
