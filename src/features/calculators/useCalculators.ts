import { useMutation } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { CalculatorDefinition } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['calculators'];

/** Звёздочка не относится к содержимому калькулятора и потому не входит в его создание/правку. */
export type CreateCalculatorPayload = Omit<CalculatorDefinition, 'id' | 'createdAt' | 'favourite'>;

const resource = createCrudResource<CalculatorDefinition, CreateCalculatorPayload>('/calculators', QUERY_KEY);

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
  const { items, isLoading, error, refetch, create, update, remove, replaceInCache } = useCrudResource(resource);

  const favouriteMutation = useMutation({
    mutationFn: ({ id, favourite }: { id: string; favourite: boolean }) => setFavourite(id, favourite),
    // Звёздочку жмут на списке из тридцати карточек — ждать перезагрузку списка ради галочки незачем.
    onSuccess: replaceInCache,
  });

  return {
    calculators: items,
    isLoading,
    error,
    refetch,
    addCalculator: (definition: CalculatorDefinition) => create(toPayload(definition)),
    updateCalculator: (definition: CalculatorDefinition) => update(definition.id, toPayload(definition)),
    deleteCalculator: remove,
    toggleFavourite: (definition: CalculatorDefinition) =>
      favouriteMutation.mutateAsync({ id: definition.id, favourite: !definition.favourite }),
  };
}
