import dayjs from 'dayjs';

export function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const age = dayjs().diff(dayjs(birthDate), 'year');
  return age >= 0 ? age : null;
}

export function formatAge(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  if (mod10 === 1 && mod100 !== 11) return `${age} год`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${age} года`;
  return `${age} лет`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export type ReminderStatus = 'overdue' | 'today' | 'upcoming';

export function getReminderStatus(reminderDate: string): ReminderStatus {
  const diff = dayjs(reminderDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}
