import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import type { Reminder } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['reminders'];

export type ReminderInput = Pick<Reminder, 'title' | 'message' | 'datetime'>;

type ReminderUpdate = Partial<ReminderInput> & { notifiedAt?: string | null };

const resource = createCrudResource<Reminder, ReminderInput, ReminderUpdate>('/reminders', QUERY_KEY);

export function useReminders() {
  const { items: reminders, isLoading, error, refetch, invalidate, create, update, remove } = useCrudResource(resource);

  return {
    reminders,
    isLoading,
    error,
    refetch,
    addReminder: create,
    // Правка напоминания снимает отметку о показе: перенесённое на завтра должно прозвонить снова.
    updateReminder: (id: string, input: ReminderInput) => update(id, { ...input, notifiedAt: null }),
    deleteReminder: remove,
    // Отметка о показе — не правка напоминания, а след того, что оно уже сработало.
    markNotified: useInvalidatingMutation(invalidate, (id: string) =>
      resource.repo.update(id, { notifiedAt: new Date().toISOString() }),
    ),
  };
}
