import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../../lib/httpRepository';
import type { DocumentTemplate } from './templateTypes';

const QUERY_KEY = ['document-templates'];

export type DocumentTemplateInput = Pick<DocumentTemplate, 'title' | 'bodyHtml'>;

const repo = createHttpRepository<DocumentTemplate, DocumentTemplateInput>('/document-templates');

export function useDocumentTemplates() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addTemplateMutation = useMutation({
    mutationFn: (input: DocumentTemplateInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: DocumentTemplateInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    templates,
    isLoading,
    addTemplate: addTemplateMutation.mutateAsync,
    updateTemplate: (id: string, input: DocumentTemplateInput) => updateTemplateMutation.mutateAsync({ id, input }),
    deleteTemplate: deleteTemplateMutation.mutateAsync,
  };
}
