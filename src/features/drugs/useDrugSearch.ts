import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import type { DrugSummary } from './types';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Поиск препарата для строки в шапке приложения.
 *
 * Серверный, а не по загруженному списку, и это не стиль. Строка поиска стоит на **каждой**
 * странице; `useDrugs()` в ней означал бы, что весь формуляр — 21 КБ gzip на полутора тысячах
 * карточек — скачивается при каждом входе в приложение, включая тех, кто препараты не ищет никогда.
 * Ровно по этой причине на сервер ранее уехал и поиск по МКБ-10.
 *
 * Ищется и по МНН, и по торговым названиям: пациент называет торговое, и с него поиск на приёме и
 * начинается.
 */
export function useDrugSearch(query: string, limit = 4) {
  const [debounced] = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['drug-search', debounced, limit],
    queryFn: () => request<DrugSummary[]>(`/drugs/search?q=${encodeURIComponent(debounced)}&limit=${limit}`),
    enabled,
    // Список препаратов меняется редко: повторный набор того же запроса не должен идти в сеть.
    staleTime: 5 * 60_000,
  });

  return { drugs: enabled ? (data ?? []) : [], isFetching: enabled && isFetching };
}
