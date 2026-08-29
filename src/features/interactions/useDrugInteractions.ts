import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { DrugInteraction } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['drug-interactions'];

export type DrugInteractionInput = Pick<DrugInteraction, 'drugA' | 'drugB' | 'severity' | 'mechanism' | 'recommendation'>;

const resource = createCrudResource<DrugInteraction, DrugInteractionInput>('/drug-interactions', QUERY_KEY);

export function useDrugInteractions() {
  const { items, isLoading, error, refetch, create, remove } = useCrudResource(resource);

  return {
    interactions: items,
    isLoading,
    error,
    refetch,
    addInteraction: create,
    deleteInteraction: remove,
  };
}
