import { useQuery } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Abbreviation, AbbreviationInput } from './types';

export const QUERY_KEY = ['abbreviations'] as const;

const resource = createCrudResource<Abbreviation, AbbreviationInput>('/abbreviations', QUERY_KEY);

export function useAbbreviations() {
  const { items, isLoading, isSuccess, error, refetch, create, update, remove } = useCrudResource(resource);
  return {
    abbreviations: items,
    isLoading,
    isSuccess,
    error,
    refetch,
    createAbbreviation: create,
    updateAbbreviation: update,
    deleteAbbreviation: remove,
  };
}

/**
 * Разделы приходят с сервера, а не собираются по загруженным записям.
 *
 * Собрать их из самого списка было бы дешевле и обошлось бы без запроса — но раздел, из которого
 * врач удалил последнюю запись, тогда исчез бы из формы добавления, и завести туда новую стало бы
 * нечем. Список закрытый и не меняется между релизами, поэтому держится весь сеанс.
 */
export function useAbbreviationSections() {
  const { data } = useQuery({
    queryKey: ['abbreviation-sections'],
    queryFn: () => request<string[]>('/abbreviations/sections'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? [];
}
