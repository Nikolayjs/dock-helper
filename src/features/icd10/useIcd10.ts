import { useQuery } from '@tanstack/react-query';

import { API_BASE_URL } from '../../lib/apiConfig';
import { isDemoSession } from '../demo/demoSession';
import type { Icd10Card, Icd10ChapterInfo, Icd10ListRow } from './types';

/**
 * Справочник МКБ-10 — с сервера, и это единственный возможный вариант.
 *
 * Классификация весит два мегабайта: четырнадцать с половиной тысяч кодов. Поставлять её в браузер
 * нельзя ни целиком (это вес всего приложения ещё раз), ни выборочно (тогда поиск перестанет
 * находить то, чего не выбрали). Поэтому список, карточка и поиск — три запроса к серверу, и по той
 * же причине они объявлены публичными: это неизменная номенклатура, а не данные врача.
 *
 * **В демо-режиме раздел недоступен**, как распознавание сканов и приглашение врача: демо работает
 * без сервера, а два мегабайта классификации в его чанк не положить. Поиск диагноза в демо остаётся
 * — его кормит короткий список ходовых кодов (`demoIcd10.ts`).
 */
export class Icd10Unavailable extends Error {}

async function get<T>(path: string): Promise<T> {
  if (isDemoSession()) {
    throw new Icd10Unavailable('В демо-режиме справочник МКБ-10 недоступен: классификация живёт на сервере, а демо работает без него.');
  }
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Не удалось загрузить справочник МКБ-10 (${response.status}).`);
  return (await response.json()) as T;
}

/**
 * Классификация не меняется между релизами, поэтому запрошенное держится весь сеанс: возврат к
 * списку после карточки не должен стоить ещё полсотни килобайт.
 */
const FOREVER = { staleTime: Infinity, gcTime: Infinity, retry: false } as const;

export function useIcd10Chapters() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['icd10-chapters'],
    queryFn: () => get<Icd10ChapterInfo[]>('/icd10/chapters'),
    ...FOREVER,
  });
  return { chapters: data ?? [], isLoading, error, refetch };
}

export function useIcd10List() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['icd10-list'],
    queryFn: () => get<Icd10ListRow[]>('/icd10/list'),
    ...FOREVER,
  });
  return { rows: data ?? [], isLoading, error, refetch };
}

export function useIcd10Card(code: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['icd10-card', code],
    queryFn: () => get<Icd10Card>(`/icd10/code/${encodeURIComponent(code ?? '')}`),
    enabled: Boolean(code),
    ...FOREVER,
  });
  return { card: data ?? null, isLoading, error };
}
