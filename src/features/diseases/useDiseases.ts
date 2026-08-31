import { useQuery } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Disease, DiseaseInput, DiseaseLink, DiseaseSummary } from './types';

export const QUERY_KEY = ['diseases'] as const;

const resource = createCrudResource<DiseaseSummary, DiseaseInput>('/diseases', QUERY_KEY, {
  // Правка описания меняет и карточку болезни, и обратные ссылки на неё у соседей.
  alsoInvalidate: [['disease'], ['disease-mentions']],
});

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

/**
 * Одна болезнь целиком — с описанием.
 *
 * Список приходит без описаний, поэтому карточка и редактор дочитывают запись отдельным запросом.
 * Пока он идёт, название, коды и раздел уже есть в списке: страница рисует шапку сразу и не мигает
 * пустотой — ровно как карточка документа базы знаний.
 */
export function useDisease(id: string | undefined) {
  const query = useQuery({
    queryKey: ['disease', id],
    queryFn: () => request<Disease>(`/diseases/${id}`),
    enabled: Boolean(id),
  });
  return { disease: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
}

/** Кто ссылается сюда: болезни, в описании которых стоит `[[Название]]` этой. Считает сервер. */
export function useDiseaseMentions(id: string | undefined) {
  const query = useQuery({
    queryKey: ['disease-mentions', id],
    queryFn: () => request<DiseaseLink[]>(`/diseases/${id}/mentions`),
    enabled: Boolean(id),
  });
  return { mentions: query.data ?? [], isLoading: query.isLoading };
}

/**
 * Болезни, которые кодируются этим кодом МКБ-10.
 *
 * Отдельным запросом, а не полем карточки кода: классификация — общая номенклатура и отдаётся без
 * входа, а справочник заболеваний принадлежит рабочему пространству.
 */
export function useDiseasesByCode(code: string | undefined) {
  const query = useQuery({
    queryKey: ['diseases-by-code', code],
    queryFn: () => request<DiseaseLink[]>(`/diseases/by-code/${encodeURIComponent(code ?? '')}`),
    enabled: Boolean(code),
  });
  return { diseases: query.data ?? [], isLoading: query.isLoading };
}
