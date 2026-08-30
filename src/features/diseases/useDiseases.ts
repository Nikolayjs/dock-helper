import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { Disease, DiseaseInput } from './types';

export const QUERY_KEY = ['diseases'] as const;

const resource = createCrudResource<Disease, DiseaseInput>('/diseases', QUERY_KEY);

export function useDiseases() {
  const { items, isLoading, isSuccess, error, refetch, create, update, remove } = useCrudResource(resource);
  return {
    diseases: items,
    isLoading,
    isSuccess,
    error,
    refetch,
    createDisease: create,
    updateDisease: update,
    deleteDisease: remove,
  };
}
