import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { BackendLabTest, CreateLabTestPayload } from './customTypes';

const QUERY_KEY = ['lab-tests'];
const repo = createHttpRepository<BackendLabTest, CreateLabTestPayload>('/custom-lab-tests');

export function useCustomAnalyzers() {
  const queryClient = useQueryClient();
  const { data: customTests = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addTestMutation = useMutation({
    mutationFn: (payload: CreateLabTestPayload) => repo.create(payload),
    onSuccess: invalidate,
  });

  const updateTestMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateLabTestPayload }) => repo.update(id, payload),
    onSuccess: invalidate,
  });

  const deleteTestMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    customTests,
    isLoading,
    addTest: addTestMutation.mutateAsync,
    updateTest: (id: string, payload: CreateLabTestPayload) => updateTestMutation.mutateAsync({ id, payload }),
    deleteTest: deleteTestMutation.mutateAsync,
  };
}
