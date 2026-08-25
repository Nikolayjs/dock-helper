import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { Drug, DrugInput } from './types';

const QUERY_KEY = ['drugs'];

const repo = createHttpRepository<Drug, DrugInput>('/drugs');

export function useDrugs() {
  const queryClient = useQueryClient();
  const { data: drugs = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({ mutationFn: (input: DrugInput) => repo.create(input), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DrugInput> }) => repo.update(id, input),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => repo.remove(id), onSuccess: invalidate });

  return {
    drugs,
    isLoading,
    createDrug: createMutation.mutateAsync,
    updateDrug: updateMutation.mutateAsync,
    deleteDrug: deleteMutation.mutateAsync,
  };
}
