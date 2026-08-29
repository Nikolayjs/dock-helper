import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { KnowledgeDocument, KnowledgeDocumentSummary, KnowledgeKind } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['knowledge-documents'];

export type DocumentInput = Pick<KnowledgeDocument, 'kind' | 'title' | 'summary' | 'content' | 'tags' | 'author'>;

const repo = createHttpRepository<KnowledgeDocumentSummary, DocumentInput>('/knowledge-documents');

function useKnowledgeQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
}

function useKnowledgeMutations() {
  const queryClient = useQueryClient();
  // Правка документа меняет и список, и его собственный кеш: список отдаётся без текста, поэтому
  // один `invalidate` на оба ключа — иначе страница просмотра показывала бы старое тело.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['knowledge-document'] });
  };

  const addDocumentMutation = useMutation({
    mutationFn: (input: DocumentInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DocumentInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    addDocument: addDocumentMutation.mutateAsync,
    updateDocument: (id: string, input: DocumentInput) => updateDocumentMutation.mutateAsync({ id, input }),
    deleteDocument: deleteDocumentMutation.mutateAsync,
  };
}

export function useDocuments(kind: KnowledgeKind) {
  const query = useKnowledgeQuery();
  const mutations = useKnowledgeMutations();
  const documents = useMemo(() => (query.data ?? []).filter((doc) => doc.kind === kind), [query.data, kind]);

  return { documents, isLoading: query.isLoading, ...mutations };
}

/** Same storage as {@link useDocuments}, but unfiltered — for views that span both guidelines and articles. */
export function useAllDocuments() {
  const query = useKnowledgeQuery();
  const { deleteDocument } = useKnowledgeMutations();

  return { documents: query.data ?? [], isLoading: query.isLoading, deleteDocument };
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
 * Отдельный ключ кеша, чтобы тяжёлый ответ не подменял собой лёгкий список на остальных страницах.
 */
export function useAllDocumentsWithContent() {
  const query = useQuery({
    queryKey: ['knowledge-documents', 'full'],
    queryFn: () => request<KnowledgeDocument[]>('/knowledge-documents?full=1'),
  });

  return { documents: query.data ?? [], isLoading: query.isLoading };
}
