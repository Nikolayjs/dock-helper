import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { KnowledgeDocument, KnowledgeDocumentSummary, KnowledgeKind } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['knowledge-documents'];

export type DocumentInput = Pick<KnowledgeDocument, 'kind' | 'title' | 'summary' | 'content' | 'tags' | 'author'>;

// Правка документа меняет и список, и его собственный кэш: список отдаётся без текста, поэтому без
// второго ключа страница просмотра показывала бы старое тело.
const resource = createCrudResource<KnowledgeDocumentSummary, DocumentInput>(
  '/knowledge-documents',
  QUERY_KEY,
  { alsoInvalidate: [['knowledge-document']] },
);

export function useDocuments(kind: KnowledgeKind) {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);
  const documents = useMemo(() => items.filter((doc) => doc.kind === kind), [items, kind]);

  return {
    documents,
    isLoading,
    error,
    refetch,
    addDocument: create,
    updateDocument: update,
    deleteDocument: remove,
  };
}

/** То же хранилище, что у {@link useDocuments}, но без отбора — для страниц, где рекомендации и статьи вместе. */
export function useAllDocuments() {
  const { items, isLoading, error, refetch, remove } = useCrudResource(resource);
  return { documents: items, isLoading, error, refetch, deleteDocument: remove };
}

/**
 * Один документ целиком.
 *
 * Список приходит без текстов (см. `types.ts`), поэтому страница просмотра и редактор дочитывают
 * документ отдельным запросом. Пока он идёт, название и теги уже есть в списке — страница
 * показывает их сразу и не мигает пустотой.
 */
export function useKnowledgeDocument(id: string | undefined) {
  const query = useQuery({
    queryKey: ['knowledge-document', id],
    queryFn: () => request<KnowledgeDocument>(`/knowledge-documents/${id}`),
    enabled: Boolean(id),
  });

  return { document: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
}

/**
 * Все документы вместе с текстами — только для графа связей.
 *
 * Рёбра графа строятся по ссылкам `[[Название]]` внутри документов, а значит текст ему нужен.
 * Отдельный ключ кэша, чтобы тяжёлый ответ не подменял собой лёгкий список на остальных страницах.
 */
export function useAllDocumentsWithContent() {
  const query = useQuery({
    queryKey: ['knowledge-documents', 'full'],
    queryFn: () => request<KnowledgeDocument[]>('/knowledge-documents?full=1'),
  });

  return { documents: query.data ?? [], isLoading: query.isLoading };
}
