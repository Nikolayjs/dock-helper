import dayjs from 'dayjs';

import type { PatientVisit } from './types';

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

/**
 * Индекс массы тела — если есть из чего его считать.
 *
 * Толкования здесь нет намеренно: пороги живут в калькуляторе ИМТ, и второй их набор разошёлся бы
 * с первым при первой же правке. Карточка показывает число, а что оно значит — отвечает калькулятор.
 */
export function bodyMassIndex(heightCm: number | null, weightKg: number | null): number | null {
  // Ноль — не «не указано», а невозможный рост: делить на него нечего.
  if (!heightCm || !weightKg) return null;
  const metres = heightCm / 100;
  return Math.round((weightKg / (metres * metres)) * 10) / 10;
}

/**
 * Визиты по убыванию давности: сначала последний приём.
 *
 * **Порядок массива визитов ничем не гарантирован**, и полагаться на нулевой элемент нельзя. Сервер
 * отдаёт их так, как отдаёт, а демо-режим дописывает новый визит в конец — то есть добавленный
 * сегодня приём оказывался бы в конце списка, и картотека показывала бы прошлогоднюю дату и
 * прошлогодний диагноз. Сортировка по дате приёма, а при равной дате — по времени создания записи:
 * два приёма в один день ставит по порядку, в котором их завели.
 */
export function sortedVisits(visits: PatientVisit[]): PatientVisit[] {
  return [...visits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Последний приём пациента — или `undefined`, если приёмов ещё не было. */
export function lastVisitOf(patient: { visits: PatientVisit[] }): PatientVisit | undefined {
  let latest: PatientVisit | undefined;
  for (const visit of patient.visits) {
    if (!latest || visit.date > latest.date || (visit.date === latest.date && visit.createdAt > latest.createdAt)) {
      latest = visit;
    }
  }
  return latest;
}
