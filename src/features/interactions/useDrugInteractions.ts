import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { DrugInteraction } from './types';

const QUERY_KEY = ['drug-interactions'];

export type DrugInteractionInput = Pick<DrugInteraction, 'drugA' | 'drugB' | 'severity' | 'mechanism' | 'recommendation'>;

const repo = createHttpRepository<DrugInteraction, DrugInteractionInput>('/drug-interactions');

export function useDrugInteractions() {
  const queryClient = useQueryClient();
  const { data: interactions = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addInteractionMutation = useMutation({
    mutationFn: (input: DrugInteractionInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const deleteInteractionMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    interactions,
    isLoading,
    addInteraction: addInteractionMutation.mutateAsync,
    deleteInteraction: deleteInteractionMutation.mutateAsync,
  };
}
