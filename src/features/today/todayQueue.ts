import dayjs from 'dayjs';

import type { DispensaryRecord, Patient, PatientVisit } from '../patients/types';

/** Почему человек в сегодняшнем списке. */
export interface TodayReason {
  kind: 'reminder' | 'dispensary';
  /** Что показать: текст напоминания или диагноз карты учёта. */
  text: string;
  /** Дней просрочки: больше нуля — срок прошёл, ноль — сегодня. */
  daysLate: number;
}

export interface TodayEntry {
  patient: Patient;
  /** Причин может быть несколько: напоминание и явка приходятся на один день сплошь и рядом. */
  reasons: TodayReason[];
  /** Самая просроченная из причин — по ней и порядок. */
  daysLate: number;
}

export interface SeenToday {
  patient: Patient;
  visit: PatientVisit;
}

const startOf = (date: string) => dayjs(date).startOf('day');

/**
 * Кого ждём сегодня.
 *
 * Складывается из двух источников — напоминания в карточке и диспансерной явки, — и **одна строка
 * на человека**, даже если сработали оба: список, где один и тот же пациент стоит дважды, приводит
 * к двум звонкам одному человеку.
 *
 * **Просроченное входит наравне с сегодняшним.** «Мой день» — это то, что надо сделать сегодня, а
 * пропущенная вчера явка сегодняшней работой и является; список, показывающий только ровно
 * сегодняшние даты, был бы честен ровно один день в году.
 *
 * **Кого уже приняли сегодня, в списке нет.** Иначе он не убывал бы к концу приёма, а именно это и
 * есть его смысл; принятые показываются отдельно.
 *
 * Карта учёта, оставшаяся от удалённого пациента, сюда не попадает: позвать некого. В диспансерном
 * отчёте такая карта по-прежнему стоит строкой «Пациент удалён» — там она про учёт, а не про приём.
 */
export function getTodayQueue(
  patients: Patient[],
  records: DispensaryRecord[],
  today = dayjs(),
): TodayEntry[] {
  const day = today.startOf('day');
  const iso = day.format('YYYY-MM-DD');
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const entries = new Map<string, TodayEntry>();

  const add = (patient: Patient, reason: TodayReason) => {
    if (patient.visits.some((visit) => visit.date === iso)) return;
    const entry = entries.get(patient.id) ?? { patient, reasons: [], daysLate: reason.daysLate };
    entry.reasons.push(reason);
    entry.daysLate = Math.max(entry.daysLate, reason.daysLate);
    entries.set(patient.id, entry);
  };

  for (const patient of patients) {
    if (!patient.reminderDate) continue;
    const due = startOf(patient.reminderDate);
    if (!due.isValid() || due.isAfter(day)) continue;
    add(patient, { kind: 'reminder', text: patient.reminderNote, daysLate: day.diff(due, 'day') });
  }

  for (const record of records) {
    if (record.status !== 'active' || !record.nextVisitDate) continue;
    const patient = byId.get(record.patientId);
    if (!patient) continue;
    const due = startOf(record.nextVisitDate);
    if (!due.isValid() || due.isAfter(day)) continue;
    add(patient, { kind: 'dispensary', text: record.diagnosis, daysLate: day.diff(due, 'day') });
  }

  return [...entries.values()].sort(
    (a, b) => b.daysLate - a.daysLate || a.patient.fullName.localeCompare(b.patient.fullName, 'ru'),
  );
}

/** Кого уже приняли сегодня — то, что за день сделано. */
export function getSeenToday(patients: Patient[], today = dayjs()): SeenToday[] {
  const iso = today.startOf('day').format('YYYY-MM-DD');
  const seen: SeenToday[] = [];

  for (const patient of patients) {
    for (const visit of patient.visits) {
      if (visit.date === iso) seen.push({ patient, visit });
    }
  }

  return seen.sort((a, b) => b.visit.createdAt.localeCompare(a.visit.createdAt));
}
