import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { CalculatorDefinition } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['calculators'];

export type CreateCalculatorPayload = Omit<CalculatorDefinition, 'id' | 'createdAt'>;

const repo = createHttpRepository<CalculatorDefinition, CreateCalculatorPayload>('/calculators');

function toPayload(definition: CalculatorDefinition): CreateCalculatorPayload {
  const { id: _id, createdAt: _createdAt, ...payload } = definition;
  return payload;
}

export function useCalculators() {
  const queryClient = useQueryClient();
  const { data: calculators = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addCalculatorMutation = useMutation({
    mutationFn: (definition: CalculatorDefinition) => repo.create(toPayload(definition)),
    onSuccess: invalidate,
  });

  const updateCalculatorMutation = useMutation({
    mutationFn: (definition: CalculatorDefinition) => repo.update(definition.id, toPayload(definition)),
    onSuccess: invalidate,
  });

  const deleteCalculatorMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    calculators,
    isLoading,
    addCalculator: addCalculatorMutation.mutateAsync,
    updateCalculator: updateCalculatorMutation.mutateAsync,
    deleteCalculator: deleteCalculatorMutation.mutateAsync,
  };
}
