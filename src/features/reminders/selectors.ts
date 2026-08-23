import dayjs from 'dayjs';

import type { Reminder } from './types';

export function getUpcomingReminders(reminders: Reminder[], days = 7): Reminder[] {
  const now = dayjs();
  const horizon = now.add(days, 'day');
  return reminders
    .filter((reminder) => {
      const at = dayjs(reminder.datetime);
      return !at.isBefore(now) && at.isBefore(horizon);
    })
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

export function getDueReminders(reminders: Reminder[]): Reminder[] {
  const now = dayjs();
  return reminders.filter((reminder) => !reminder.notifiedAt && !dayjs(reminder.datetime).isAfter(now));
}

export function getRemindersByDate(reminders: Reminder[]): Map<string, Reminder[]> {
  const map = new Map<string, Reminder[]>();
  for (const reminder of reminders) {
    const key = dayjs(reminder.datetime).format('YYYY-MM-DD');
    const list = map.get(key) ?? [];
    list.push(reminder);
    map.set(key, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.datetime.localeCompare(b.datetime));
  return map;
}
