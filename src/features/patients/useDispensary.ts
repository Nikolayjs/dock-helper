import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { DispensaryObservation, DispensaryRecord, DispensaryRemovalReason } from './types';

const QUERY_KEY = ['dispensary-records'];

export type DispensaryRecordInput = Pick<DispensaryRecord, 'patientId' | 'diagnosis' | 'diagnosisCode' | 'registeredDate' | 'nextVisitDate'>;
export type ObservationInput = Pick<DispensaryObservation, 'date' | 'outcome' | 'ovl' | 'sanatorium' | 'campRest' | 'note'>;

const repo = createHttpRepository<DispensaryRecord, DispensaryRecordInput>('/dispensary');

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
  const queryClient = useQueryClient();
  const { data: records = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addRecordMutation = useMutation({
    mutationFn: (input: DispensaryRecordInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DispensaryRecordInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  const removeFromRegistryMutation = useMutation({
    mutationFn: ({ id, removedDate, removedReason }: { id: string; removedDate: string; removedReason: DispensaryRemovalReason }) =>
      removeFromRegistry(id, removedDate, removedReason),
    onSuccess: invalidate,
  });

  const reinstateRecordMutation = useMutation({
    mutationFn: (id: string) => reinstateRecord(id),
    onSuccess: invalidate,
  });

  const addObservationMutation = useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: ObservationInput }) => addObservation(recordId, input),
    onSuccess: invalidate,
  });

  const updateObservationMutation = useMutation({
    mutationFn: ({ recordId, observationId, input }: { recordId: string; observationId: string; input: ObservationInput }) =>
      updateObservation(recordId, observationId, input),
    onSuccess: invalidate,
  });

  const deleteObservationMutation = useMutation({
    mutationFn: ({ recordId, observationId }: { recordId: string; observationId: string }) => deleteObservation(recordId, observationId),
    onSuccess: invalidate,
  });

  return {
    records,
    isLoading,
    addRecord: addRecordMutation.mutateAsync,
    updateRecord: (id: string, input: DispensaryRecordInput) => updateRecordMutation.mutateAsync({ id, input }),
    deleteRecord: deleteRecordMutation.mutateAsync,
    removeFromRegistry: (id: string, removedDate: string, removedReason: DispensaryRemovalReason) =>
      removeFromRegistryMutation.mutateAsync({ id, removedDate, removedReason }),
    reinstateRecord: reinstateRecordMutation.mutateAsync,
    addObservation: (recordId: string, input: ObservationInput) => addObservationMutation.mutateAsync({ recordId, input }),
    updateObservation: (recordId: string, observationId: string, input: ObservationInput) =>
      updateObservationMutation.mutateAsync({ recordId, observationId, input }),
    deleteObservation: (recordId: string, observationId: string) =>
      deleteObservationMutation.mutateAsync({ recordId, observationId }),
  };
}
