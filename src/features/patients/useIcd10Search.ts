import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL } from '../../lib/apiConfig';

export interface Icd10Entry {
  code: string;
  name: string;
}

const DEBOUNCE_MS = 250;
const LIMIT = 8;
const MIN_QUERY_LENGTH = 2;

async function fetchIcd10(query: string): Promise<Icd10Entry[]> {
  const url = `${API_BASE_URL}/icd10/search?q=${encodeURIComponent(query)}&limit=${LIMIT}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return (await response.json()) as Icd10Entry[];
}

/**
 * МКБ-10 search now runs server-side (dock-helper-api/src/icd10) — the ~2MB nomenclature no
 * longer ships in this bundle. Debounced since every keystroke would otherwise be a request.
 */
export function useIcd10Search(query: string) {
  const [debounced] = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const enabled = debounced.length >= MIN_QUERY_LENGTH;

  const { data, isFetching } = useQuery({
    queryKey: ['icd10-search', debounced],
    queryFn: () => fetchIcd10(debounced),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return { results: enabled ? (data ?? []) : [], isSearching: enabled && isFetching };
}
