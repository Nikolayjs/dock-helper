import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
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
  const { items: notes, isLoading, error, refetch, create, update, remove, optimisticUpdate } = useCrudResource(resource);

  return {
    notes,
    isLoading,
    error,
    refetch,
    addNote: create,
    updateNote: update,
    deleteNote: remove,
    /**
     * Отметка ставится сразу, а сервер догоняет.
     *
     * До этого нажатие ждало круга по сети **и перезагрузки всего списка заметок** — а список
     * везёт с собой тексты вместе с вставленными картинками. На телефоне это была задержка в
     * секунды на каждый пункт, то есть чек-лист, которым нельзя пользоваться по ходу дела.
     */
    toggleTodoItem: (noteId: string, itemId: string) =>
      optimisticUpdate(
        noteId,
        (note) => ({ ...note, items: note.items.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)) }),
        () => toggleTodoItem(noteId, itemId),
      ),
  };
}
