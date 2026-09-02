import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';
import { QUERY_KEY as LAB_TESTS_KEY } from '../analyzer/useCustomAnalyzers';
import { QUERY_KEY as CALCULATORS_KEY } from '../calculators/useCalculators';
import { QUERY_KEY as QUESTIONNAIRES_KEY } from '../diagnostics/useQuestionnaires';
import { QUERY_KEY as TEMPLATES_KEY } from '../patients/documents/useDocumentTemplates';
import { QUERY_KEY as LIBRARY_KEY } from '../library/useLibrary';

export type StoreKind = 'analyzer' | 'calculator' | 'questionnaire' | 'template' | 'book';

export interface StoreItem {
  kind: StoreKind;
  key: string;
  title: string;
  description: string;
  specialties: string[];
  /** Рублей; 0 — бесплатно. Платного пока нет ничего. */
  price: number;
  installed: boolean;
  /** Идентификатор установленной записи — по нему «Открыть» ведёт прямо в неё. */
  installedId: string | null;
}

export const QUERY_KEY = ['store-items'];

/** Кэш раздела, в который попадает установленное: без него врач вернётся к прежнему списку. */
const SECTION_KEY: Record<StoreKind, string[]> = {
  analyzer: LAB_TESTS_KEY,
  calculator: CALCULATORS_KEY,
  questionnaire: QUESTIONNAIRES_KEY,
  template: TEMPLATES_KEY,
  book: LIBRARY_KEY,
};

/** Куда ведёт «Открыть» у установленной позиции. */
export function installedPath(item: StoreItem): string {
  const id = item.installedId ?? '';
  switch (item.kind) {
    case 'analyzer':
      return `/analyzer?test=${encodeURIComponent(id)}`;
    case 'calculator':
      return `/calculators/${id}`;
    case 'questionnaire':
      return `/diagnostics/${id}`;
    case 'template':
      return `/documents/templates/${id}/edit`;
    case 'book':
      return `/library/${id}`;
  }
}

export function useStore() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<StoreItem[]>('/store/items'),
  });

  const install = useMutation({
    mutationFn: (item: StoreItem) =>
      request<{ id: string }>('/store/install', {
        method: 'POST',
        body: JSON.stringify({ kind: item.kind, key: item.key }),
      }),
    onSuccess: (_result, item) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // И раздел, куда запись только что попала: врач идёт туда следующим шагом, и застать там
      // прежний список значило бы решить, что установка не сработала.
      void queryClient.invalidateQueries({ queryKey: SECTION_KEY[item.kind] });
    },
  });

  /**
   * Поставить набор одним запросом.
   *
   * По одной позиции — это по запросу на каждую, а ограничитель на сервере пускает двадцать в
   * минуту: набор из сорока панелей обрывался бы на середине с 429, оставляя половину. Поэтому
   * список уходит целиком, а сервер ставит его подряд.
   */
  const installMany = useMutation({
    mutationFn: (items: StoreItem[]) =>
      request<{ installed: number }>('/store/install-many', {
        method: 'POST',
        body: JSON.stringify({ items: items.map((item) => ({ kind: item.kind, key: item.key })) }),
      }),
    onSuccess: (_result, items) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      for (const kind of new Set(items.map((item) => item.kind))) {
        void queryClient.invalidateQueries({ queryKey: SECTION_KEY[kind] });
      }
    },
  });

  return { items: data ?? [], isLoading: isPending, install, installMany };
}
