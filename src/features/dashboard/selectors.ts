import dayjs from "dayjs";

import type { Note, TodoItem } from "../notes/types";
import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from "../patients/referralUtils";
import type { Patient, ReferralCategory } from "../patients/types";
import { getReminderStatus, lastVisitOf, type ReminderStatus } from "../patients/utils";

export interface ChecklistItem extends TodoItem {
  noteId: string;
  noteTitle: string;
}

export function getTodayChecklist(notes: Note[]): ChecklistItem[] {
  const today = dayjs().format("YYYY-MM-DD");
  return notes
    .filter((note) => note.kind === "todo" && note.pinnedDate === today)
    .flatMap((note) =>
      note.items.map((item) => ({ ...item, noteId: note.id, noteTitle: note.title })),
    );
}

export function getTodayNotes(notes: Note[]): Note[] {
  const today = dayjs().format("YYYY-MM-DD");
  return notes.filter((note) => note.pinnedDate === today);
}

export function getRecentPatients(patients: Patient[], limit: number): Patient[] {
  // Сравниваются последние приёмы, а не нулевые элементы: порядок массива визитов ничем не задан.
  return [...patients]
    .filter((patient) => patient.visits.length > 0)
    .sort((a, b) => (lastVisitOf(b)?.date ?? '').localeCompare(lastVisitOf(a)?.date ?? ''))
    .slice(0, limit);
}

export interface UpcomingReminder {
  patient: Patient;
  status: ReminderStatus;
}

export function getUpcomingReminders(patients: Patient[], limit: number): UpcomingReminder[] {
  return patients
    .filter((patient): patient is Patient & { reminderDate: string } =>
      Boolean(patient.reminderDate),
    )
    .sort((a, b) => a.reminderDate.localeCompare(b.reminderDate))
    .slice(0, limit)
    .map((patient) => ({ patient, status: getReminderStatus(patient.reminderDate) }));
}

export function getWeeklyVisitFlow(patients: Patient[]) {
  const counts = new Map<string, number>();
  for (const patient of patients) {
    for (const visit of patient.visits) {
      const key = dayjs(visit.date).format("YYYY-MM-DD");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from({ length: 7 }).map((_, index) => {
    const date = dayjs().subtract(6 - index, "day");
    const key = date.format("YYYY-MM-DD");
    const label = date.format("dd");
    return { day: label.charAt(0).toUpperCase() + label.slice(1), visits: counts.get(key) ?? 0 };
  });
}

const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  overdue: "Просрочено",
  today: "Сегодня",
  upcoming: "Предстоит",
};

const REMINDER_STATUS_COLOR: Record<ReminderStatus, string> = {
  overdue: "red.5",
  today: "orange.5",
  upcoming: "teal.5",
};

export function getReminderStatusBreakdown(patients: Patient[]) {
  const counts: Record<ReminderStatus, number> = { overdue: 0, today: 0, upcoming: 0 };
  for (const patient of patients) {
    if (!patient.reminderDate) continue;
    counts[getReminderStatus(patient.reminderDate)] += 1;
  }

  return (Object.keys(counts) as ReminderStatus[])
    .filter((status) => counts[status] > 0)
    .map((status) => ({
      name: REMINDER_STATUS_LABEL[status],
      value: counts[status],
      color: REMINDER_STATUS_COLOR[status],
    }));
}

export type ReferralPeriod = "month" | "quarter" | "halfYear" | "year";

export function getReferralPeriodRange(period: ReferralPeriod): { start: string; end: string } {
  const now = dayjs();
  if (period === "month") {
    return {
      start: now.startOf("month").format("YYYY-MM-DD"),
      end: now.endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (period === "quarter") {
    const start = now.startOf("month").subtract(now.month() % 3, "month");
    return {
      start: start.format("YYYY-MM-DD"),
      end: start.add(3, "month").subtract(1, "day").format("YYYY-MM-DD"),
    };
  }
  if (period === "halfYear") {
    const start = now.startOf("month").subtract(now.month() % 6, "month");
    return {
      start: start.format("YYYY-MM-DD"),
      end: start.add(6, "month").subtract(1, "day").format("YYYY-MM-DD"),
    };
  }
  return {
    start: now.startOf("year").format("YYYY-MM-DD"),
    end: now.endOf("year").format("YYYY-MM-DD"),
  };
}

const REFERRAL_SHADES = ["5", "7", "3", "9"];

export function getReferralBreakdown(patients: Patient[], start: string, end: string) {
  const groups = new Map<string, { value: number; category: ReferralCategory }>();
  for (const patient of patients) {
    for (const visit of patient.visits) {
      if (!visit.referralCategory) continue;
      if (visit.date < start || visit.date > end) continue;
      const label =
        visit.referralDestination.trim() || REFERRAL_CATEGORY_LABELS[visit.referralCategory];
      const existing = groups.get(label);
      if (existing) existing.value += 1;
      else groups.set(label, { value: 1, category: visit.referralCategory });
    }
  }

  const shadeIndexByCategory = new Map<ReferralCategory, number>();

  return Array.from(groups.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .map(([name, { value, category }]) => {
      const shadeIndex = shadeIndexByCategory.get(category) ?? 0;
      shadeIndexByCategory.set(category, shadeIndex + 1);
      const shade = REFERRAL_SHADES[shadeIndex % REFERRAL_SHADES.length];
      return { name, value, color: `${REFERRAL_CATEGORY_COLORS[category]}.${shade}` };
    });
}

export interface ReferralEntry {
  patientId: string;
  patientName: string;
  visitId: string;
  date: string;
  category: ReferralCategory;
  destination: string;
}

export function getReferralEntries(
  patients: Patient[],
  start: string,
  end: string,
  limit?: number,
): ReferralEntry[] {
  const entries: ReferralEntry[] = [];
  for (const patient of patients) {
    for (const visit of patient.visits) {
      if (!visit.referralCategory) continue;
      if (visit.date < start || visit.date > end) continue;
      entries.push({
        patientId: patient.id,
        patientName: patient.fullName,
        visitId: visit.id,
        date: visit.date,
        category: visit.referralCategory,
        destination: visit.referralDestination,
      });
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return limit ? entries.slice(0, limit) : entries;
}
