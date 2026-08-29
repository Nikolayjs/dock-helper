import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { BackendLabTest, CreateLabTestPayload } from './customTypes';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['lab-tests'];

const resource = createCrudResource<BackendLabTest, CreateLabTestPayload>('/custom-lab-tests', QUERY_KEY);

export function useCustomAnalyzers() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    customTests: items,
    isLoading,
    error,
    refetch,
    addTest: create,
    updateTest: update,
    deleteTest: remove,
  };
}
