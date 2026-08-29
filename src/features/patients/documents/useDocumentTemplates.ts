import { createCrudResource, useCrudResource } from '../../../lib/createCrudResource';
import type { DocumentTemplate } from './templateTypes';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['document-templates'];

/**
 * `kind` и `layout` необязательны, чтобы форма на Tiptap слала ровно то же, что и раньше: колонка
 * по умолчанию `flow` на стороне сервера, а пропущенный `layout` остаётся пустым.
 */
export type DocumentTemplateInput = Pick<DocumentTemplate, 'title' | 'bodyHtml'> &
  Partial<Pick<DocumentTemplate, 'kind' | 'layout'>>;

const resource = createCrudResource<DocumentTemplate, DocumentTemplateInput>('/document-templates', QUERY_KEY);

export function useDocumentTemplates() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    templates: items,
    isLoading,
    error,
    refetch,
    addTemplate: create,
    updateTemplate: update,
    deleteTemplate: remove,
  };
}
