import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';

export type ExtensionScope = 'clips:write' | 'catalog:read' | 'sources:write';

export interface ExtensionTokenView {
  id: string;
  label: string;
  /** Последние четыре знака значения: одной метки, чтобы различить три токена, мало. */
  preview: string;
  scopes: ExtensionScope[];
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const QUERY_KEY = ['extension-tokens'];

/**
 * Токены расширения.
 *
 * Не через `createCrudResource`: у выпуска другой ответ, чем у списка (значение показывается один
 * раз и в записи не хранится), а отзыв — это `DELETE`, отдающий обновлённую строку. Общий скелет
 * пришлось бы уговаривать на оба исключения.
 */
export function useExtensionTokens() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<ExtensionTokenView[]>('/extension-tokens'),
  });

  const issueMutation = useMutation({
    mutationFn: (input: { label: string; scopes: ExtensionScope[] }) =>
      request<{ token: string; view: ExtensionTokenView }>('/extension-tokens', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => request<ExtensionTokenView>(`/extension-tokens/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return {
    tokens: query.data ?? [],
    isLoading: query.isPending,
    error: query.error,
    issueToken: issueMutation.mutateAsync,
    isIssuing: issueMutation.isPending,
    revokeToken: revokeMutation.mutateAsync,
  };
}
