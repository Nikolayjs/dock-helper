import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { Reminder } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['reminders'];

export type ReminderInput = Pick<Reminder, 'title' | 'message' | 'datetime'>;

const repo = createHttpRepository<Reminder, ReminderInput, Partial<ReminderInput> & { notifiedAt?: string | null }>('/reminders');

export function useReminders() {
  const queryClient = useQueryClient();
  const { data: reminders = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addReminderMutation = useMutation({
    mutationFn: (input: ReminderInput) => repo.create(input),
    onSuccess: invalidate,
  });

  const updateReminderMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReminderInput }) => repo.update(id, { ...input, notifiedAt: null }),
    onSuccess: invalidate,
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  const markNotifiedMutation = useMutation({
    mutationFn: (id: string) => repo.update(id, { notifiedAt: new Date().toISOString() }),
    onSuccess: invalidate,
  });

  return {
    reminders,
    isLoading,
    addReminder: addReminderMutation.mutateAsync,
    updateReminder: (id: string, input: ReminderInput) => updateReminderMutation.mutateAsync({ id, input }),
    deleteReminder: deleteReminderMutation.mutateAsync,
    markNotified: markNotifiedMutation.mutateAsync,
  };
}
