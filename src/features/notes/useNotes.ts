import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Note } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['notes'];

export type NoteInput = Pick<Note, 'kind' | 'title' | 'content' | 'items' | 'pinnedDate' | 'color'>;

const resource = createCrudResource<Note, NoteInput>('/notes', QUERY_KEY);

/** Переключение пункта чек-листа — своя ручка на сервере: она правит один пункт, а не всю заметку. */
function toggleTodoItem(noteId: string, itemId: string): Promise<Note> {
  return request<Note>(`/notes/${noteId}/items/${itemId}/toggle`, { method: 'PATCH' });
}

export function useNotes() {
  const { items: notes, isLoading, error, refetch, invalidate, create, update, remove } = useCrudResource(resource);

  return {
    notes,
    isLoading,
    error,
    refetch,
    addNote: create,
    updateNote: update,
    deleteNote: remove,
    toggleTodoItem: useInvalidatingMutation(invalidate, toggleTodoItem),
  };
}
