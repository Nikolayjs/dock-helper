import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { DoctorDocument } from './types';

/** Кеш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['doctor-documents'];

export type DoctorDocumentInput = Pick<
  DoctorDocument,
  'kind' | 'title' | 'summary' | 'patientId' | 'content' | 'sheet' | 'tags'
>;

const repo = createHttpRepository<DoctorDocument, DoctorDocumentInput>('/documents');

export function useDoctorDocuments() {
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading, error, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addMutation = useMutation({ mutationFn: (input: DoctorDocumentInput) => repo.create(input), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DoctorDocumentInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => repo.remove(id), onSuccess: invalidate });

  return {
    documents,
    isLoading,
    error,
    refetch,
    addDocument: addMutation.mutateAsync,
    updateDocument: (id: string, input: DoctorDocumentInput) => updateMutation.mutateAsync({ id, input }),
    deleteDocument: deleteMutation.mutateAsync,
  };
}
