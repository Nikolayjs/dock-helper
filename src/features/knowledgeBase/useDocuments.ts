import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { KnowledgeDocument, KnowledgeKind } from './types';

const QUERY_KEY = ['knowledge-documents'];

export type DocumentInput = Pick<KnowledgeDocument, 'kind' | 'title' | 'summary' | 'content' | 'tags' | 'author'>;

const repo = createHttpRepository<KnowledgeDocument, DocumentInput>('/knowledge-documents');

function useKnowledgeQuery() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
}

function useKnowledgeMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

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
