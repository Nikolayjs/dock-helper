import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { LabResult, LabResultInput } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['lab-results'];

const resource = createCrudResource<LabResult, LabResultInput>('/lab-results', QUERY_KEY);

/**
 * Сохранённые анализы рабочего пространства.
 *
 * Список общий, а не по пациенту: у бэкенда есть `?patientId=`, но карточка пациента и так тянет
 * весь список пациентов, а отдельный кэш на каждого означал бы новый запрос при каждом открытии
 * карточки — и всё равно не помог бы динамике, которой нужны все бланки одного человека сразу.
 */
export function useLabResults() {
  const { items, isLoading, isSuccess, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    results: items,
    isLoading,
    isSuccess,
    error,
    refetch,
    addResult: create,
    updateResult: update,
    deleteResult: remove,
  };
}
