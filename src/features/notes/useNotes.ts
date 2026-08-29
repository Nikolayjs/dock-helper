import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { Note } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['notes'];

export type NoteInput = Pick<Note, 'kind' | 'title' | 'content' | 'items' | 'pinnedDate' | 'color'>;

const repo = createHttpRepository<Note, NoteInput>('/notes');

function toggleTodoItem(noteId: string, itemId: string): Promise<Note> {
  return request<Note>(`/notes/${noteId}/items/${itemId}/toggle`, { method: 'PATCH' });
}

export function useNotes() {
  const queryClient = useQueryClient();
  const { data: notes = [], isLoading, error, refetch } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addNoteMutation = useMutation({
    mutationFn: (input: NoteInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: NoteInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  const toggleTodoItemMutation = useMutation({
    mutationFn: ({ noteId, itemId }: { noteId: string; itemId: string }) => toggleTodoItem(noteId, itemId),
    onSuccess: invalidate,
  });

  return {
    notes,
    isLoading,
    error,
    refetch,
    addNote: addNoteMutation.mutateAsync,
    updateNote: (id: string, input: NoteInput) => updateNoteMutation.mutateAsync({ id, input }),
    deleteNote: deleteNoteMutation.mutateAsync,
    toggleTodoItem: (noteId: string, itemId: string) => toggleTodoItemMutation.mutateAsync({ noteId, itemId }),
  };
}
