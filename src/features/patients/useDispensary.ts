import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { DispensaryObservation, DispensaryRecord, DispensaryRemovalReason } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['dispensary-records'];

export type DispensaryRecordInput = Pick<DispensaryRecord, 'patientId' | 'diagnosis' | 'diagnosisCode' | 'registeredDate' | 'nextVisitDate'>;
export type ObservationInput = Pick<DispensaryObservation, 'date' | 'outcome' | 'ovl' | 'sanatorium' | 'campRest' | 'note'>;

const resource = createCrudResource<DispensaryRecord, DispensaryRecordInput>('/dispensary', QUERY_KEY);

/**
 * Снятие с учёта — не удаление карты, а её состояние: карта остаётся, у неё появляются дата и
 * причина. Поэтому своя ручка, а не `remove`.
 */
function removeFromRegistry(id: string, removedDate: string, removedReason: DispensaryRemovalReason): Promise<DispensaryRecord> {
  return request<DispensaryRecord>(`/dispensary/${id}/remove-from-registry`, {
    method: 'PATCH',
    body: JSON.stringify({ removedDate, removedReason }),
  });
}

function reinstateRecord(id: string): Promise<DispensaryRecord> {
  return request<DispensaryRecord>(`/dispensary/${id}/reinstate`, { method: 'PATCH' });
}

function addObservation(recordId: string, input: ObservationInput): Promise<DispensaryObservation> {
  return request<DispensaryObservation>(`/dispensary/${recordId}/observations`, { method: 'POST', body: JSON.stringify(input) });
}

function updateObservation(recordId: string, observationId: string, input: ObservationInput): Promise<DispensaryObservation> {
  return request<DispensaryObservation>(`/dispensary/${recordId}/observations/${observationId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function deleteObservation(recordId: string, observationId: string): Promise<void> {
  return request<void>(`/dispensary/${recordId}/observations/${observationId}`, { method: 'DELETE' });
}

export function useDispensary() {
  const { items, isLoading, error, refetch, invalidate, create, update, remove } = useCrudResource(resource);

  return {
    records: items,
    isLoading,
    error,
    refetch,
    addRecord: create,
    updateRecord: update,
    deleteRecord: remove,
    removeFromRegistry: useInvalidatingMutation(invalidate, removeFromRegistry),
    reinstateRecord: useInvalidatingMutation(invalidate, reinstateRecord),
    addObservation: useInvalidatingMutation(invalidate, addObservation),
    updateObservation: useInvalidatingMutation(invalidate, updateObservation),
    deleteObservation: useInvalidatingMutation(invalidate, deleteObservation),
  };
}
