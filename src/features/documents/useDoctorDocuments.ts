import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { DoctorDocument } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['doctor-documents'];

export type DoctorDocumentInput = Pick<
  DoctorDocument,
  'kind' | 'title' | 'summary' | 'patientId' | 'content' | 'sheet' | 'tags'
>;

const resource = createCrudResource<DoctorDocument, DoctorDocumentInput>('/documents', QUERY_KEY);

export function useDoctorDocuments() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    documents: items,
    isLoading,
    error,
    refetch,
    addDocument: create,
    updateDocument: update,
    deleteDocument: remove,
  };
}
