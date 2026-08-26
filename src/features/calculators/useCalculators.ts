import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { CalculatorDefinition } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['calculators'];

/** Звёздочка не относится к содержимому калькулятора и потому не входит в его создание/правку. */
export type CreateCalculatorPayload = Omit<CalculatorDefinition, 'id' | 'createdAt' | 'favourite'>;

const repo = createHttpRepository<CalculatorDefinition, CreateCalculatorPayload>('/calculators');

function toPayload(definition: CalculatorDefinition): CreateCalculatorPayload {
  const { id: _id, createdAt: _createdAt, favourite: _favourite, ...payload } = definition;
  return payload;
}

function setFavourite(id: string, favourite: boolean): Promise<CalculatorDefinition> {
  return request<CalculatorDefinition>(`/calculators/${id}/favourite`, {
    method: 'PATCH',
    body: JSON.stringify({ favourite }),
  });
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

  const favouriteMutation = useMutation({
    mutationFn: ({ id, favourite }: { id: string; favourite: boolean }) => setFavourite(id, favourite),
    // Звёздочку жмут на списке из тридцати карточек — ждать перезагрузку списка ради галочки незачем.
    onSuccess: (updated) => {
      queryClient.setQueryData<CalculatorDefinition[]>(QUERY_KEY, (prev) =>
        prev?.map((item) => (item.id === updated.id ? updated : item)) ?? prev,
      );
    },
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
    toggleFavourite: (definition: CalculatorDefinition) =>
      favouriteMutation.mutateAsync({ id: definition.id, favourite: !definition.favourite }),
  };
}
