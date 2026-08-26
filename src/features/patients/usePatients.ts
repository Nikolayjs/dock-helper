import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { Patient, PatientVisit } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['patients'];

export type PatientInput = Pick<Patient, 'fullName' | 'sex' | 'birthDate' | 'phone' | 'reminderDate' | 'reminderNote'>;
export type VisitInput = Pick<PatientVisit, 'date' | 'diagnosis' | 'diagnosisCode' | 'note' | 'referralCategory' | 'referralDestination'>;

const repo = createHttpRepository<Patient, PatientInput>('/patients');

export interface ImportResult {
  created: number;
  skipped: string[];
  dispensaryCreated: number;
  dispensarySkipped: number;
}

/** A patient row may also open a dispensary card, in the same request. */
export interface ImportPatientRow extends PatientInput {
  dispensary?: { diagnosis: string; diagnosisCode?: string; registeredDate: string };
}

/** One request for the whole list: the global throttle is 20/min, and a register is longer than that. */
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
  const queryClient = useQueryClient();
  const { data: patients = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addPatientMutation = useMutation({
    mutationFn: (input: PatientInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updatePatientMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatientInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const deletePatientMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  const addVisitMutation = useMutation({
    mutationFn: ({ patientId, input }: { patientId: string; input: VisitInput }) => addVisit(patientId, input),
    onSuccess: invalidate,
  });

  const updateVisitMutation = useMutation({
    mutationFn: ({ patientId, visitId, input }: { patientId: string; visitId: string; input: VisitInput }) =>
      updateVisit(patientId, visitId, input),
    onSuccess: invalidate,
  });

  const deleteVisitMutation = useMutation({
    mutationFn: ({ patientId, visitId }: { patientId: string; visitId: string }) => deleteVisit(patientId, visitId),
    onSuccess: invalidate,
  });

  const importPatientsMutation = useMutation({
    mutationFn: (input: ImportPatientRow[]) => importPatients(input),
    onSuccess: invalidate,
  });

  return {
    patients,
    isLoading,
    addPatient: addPatientMutation.mutateAsync,
    importPatients: importPatientsMutation.mutateAsync,
    updatePatient: (id: string, input: PatientInput) => updatePatientMutation.mutateAsync({ id, input }),
    deletePatient: deletePatientMutation.mutateAsync,
    addVisit: (patientId: string, input: VisitInput) => addVisitMutation.mutateAsync({ patientId, input }),
    updateVisit: (patientId: string, visitId: string, input: VisitInput) =>
      updateVisitMutation.mutateAsync({ patientId, visitId, input }),
    deleteVisit: (patientId: string, visitId: string) => deleteVisitMutation.mutateAsync({ patientId, visitId }),
  };
}
