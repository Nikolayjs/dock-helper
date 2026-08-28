/**
 * What the dashboard is for: the work that is waiting, and the shape of the practice behind it.
 *
 * The rule these were written against: a number belongs here only if the doctor would do something
 * differently on seeing it. "Patients in the database: 94" fails that — it never changes and nothing
 * follows from it. "Follow-up overdue: 7" passes, because those seven people are a list to call.
 */
import dayjs from 'dayjs';

import type { BarItem } from '../../components/common/RankedBarList';
import type { Book } from '../library/types';
import type { DispensaryRecord, Patient, PatientVisit } from '../patients/types';

/** Today at midnight — every comparison here is by calendar day, never by clock time. */
function today() {
  return dayjs().startOf('day');
}

// ── Диспансерный контроль ───────────────────────────────────────────────────

export interface DispensaryDue {
  record: DispensaryRecord;
  /** Missing when the record points at a patient who was since deleted. */
  patient: Patient | undefined;
  dueDate: string;
  /** Positive when the date has passed, 0 when it is today, negative when it is ahead. */
  daysLate: number;
}

export interface DispensaryQueue {
  overdue: DispensaryDue[];
  soon: DispensaryDue[];
}

/**
 * The follow-up queue: who was due and did not come, and who is due within `horizonDays`.
 *
 * Only `active` records count. A record removed from the registry keeps its `nextVisitDate` — it is
 * the date the follow-up *would* have been — and counting those would grow the queue with people
 * the doctor deliberately stopped watching.
 */
export function getDispensaryQueue(
  records: DispensaryRecord[],
  patients: Patient[],
  horizonDays = 7,
): DispensaryQueue {
  const start = today();
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const overdue: DispensaryDue[] = [];
  const soon: DispensaryDue[] = [];

  for (const record of records) {
    if (record.status !== 'active' || !record.nextVisitDate) continue;

    const due = dayjs(record.nextVisitDate).startOf('day');
    if (!due.isValid()) continue;

    const daysLate = start.diff(due, 'day');
    const entry: DispensaryDue = {
      record,
      patient: byId.get(record.patientId),
      dueDate: record.nextVisitDate,
      daysLate,
    };

    if (daysLate > 0) overdue.push(entry);
    else if (-daysLate <= horizonDays) soon.push(entry);
  }

  // Most overdue first; among those still ahead, the nearest first.
  overdue.sort((a, b) => b.daysLate - a.daysLate);
  soon.sort((a, b) => b.daysLate - a.daysLate);
  return { overdue, soon };
}

// ── Приёмы ──────────────────────────────────────────────────────────────────

export interface VisitCount {
  current: number;
  previous: number;
  /** Whole per cent against the previous month; null when there is no previous month to compare. */
  deltaPercent: number | null;
}

export function getMonthlyVisitCount(patients: Patient[]): VisitCount {
  const startOfMonth = dayjs().startOf('month');
  const startOfPrevious = startOfMonth.subtract(1, 'month');

  let current = 0;
  let previous = 0;
  for (const patient of patients) {
    for (const visit of patient.visits) {
      const date = dayjs(visit.date);
      if (!date.isValid()) continue;
      if (date.isSame(startOfMonth, 'month')) current += 1;
      else if (date.isSame(startOfPrevious, 'month')) previous += 1;
    }
  }

  // A month with no visits before it has nothing to be a percentage of.
  const deltaPercent = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return { current, previous, deltaPercent };
}

// ── Выпавшие из наблюдения ──────────────────────────────────────────────────

export interface LapsedPatient {
  patient: Patient;
  lastVisit: PatientVisit;
  monthsSince: number;
}

/**
 * Patients who used to come and stopped. A patient with no visits at all is deliberately not here:
 * that is someone entered but never seen, which is a different thing and a different action.
 */
export function getLapsedPatients(patients: Patient[], months = 12): LapsedPatient[] {
  const cutoff = today().subtract(months, 'month');
  const lapsed: LapsedPatient[] = [];

  for (const patient of patients) {
    const dates = patient.visits.filter((visit) => dayjs(visit.date).isValid());
    if (dates.length === 0) continue;

    const lastVisit = dates.reduce((latest, visit) => (visit.date > latest.date ? visit : latest));
    const last = dayjs(lastVisit.date).startOf('day');
    if (last.isAfter(cutoff)) continue;

    lapsed.push({ patient, lastVisit, monthsSince: today().diff(last, 'month') });
  }

  return lapsed.sort((a, b) => b.monthsSince - a.monthsSince);
}

// ── Нагрузка ────────────────────────────────────────────────────────────────

export type LoadPeriod = 'week' | 'month' | 'year';

export interface LoadPoint {
  label: string;
  visits: number;
}

const LOAD_SHAPE: Record<LoadPeriod, { count: number; unit: 'day' | 'month'; format: string }> = {
  week: { count: 7, unit: 'day', format: 'dd' },
  month: { count: 30, unit: 'day', format: 'D MMM' },
  year: { count: 12, unit: 'month', format: 'MMM' },
};

/**
 * Visits per bucket, ending today. Buckets with no visits are kept as zeros: a gap in a workload
 * chart is information — it is the week nobody came — and dropping it would draw a busier practice
 * than the real one.
 */
export function getVisitLoad(patients: Patient[], period: LoadPeriod): LoadPoint[] {
  const { count, unit, format } = LOAD_SHAPE[period];
  const key = (date: dayjs.Dayjs) => (unit === 'day' ? date.format('YYYY-MM-DD') : date.format('YYYY-MM'));

  const counts = new Map<string, number>();
  for (const patient of patients) {
    for (const visit of patient.visits) {
      const date = dayjs(visit.date);
      if (!date.isValid()) continue;
      const bucket = key(date);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
  }

  return Array.from({ length: count }, (_, index) => {
    const date = dayjs().subtract(count - 1 - index, unit);
    const label = date.format(format);
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      visits: counts.get(key(date)) ?? 0,
    };
  });
}

// ── Разрезы по пациентам ────────────────────────────────────────────────────

export interface Slice {
  label: string;
  value: number;
}

const BAND_EDGES = [18, 30, 40, 50, 60, 70];

function bandLabel(index: number): string {
  if (index === 0) return '0–17';
  if (index === BAND_EDGES.length) return '70+';
  return `${BAND_EDGES[index - 1]}–${BAND_EDGES[index] - 1}`;
}

function bandIndex(age: number): number {
  let index = 0;
  while (index < BAND_EDGES.length && age >= BAND_EDGES[index]) index += 1;
  return index;
}

/**
 * Patients by age band. The bands are the ones Russian outpatient reporting already uses, so the
 * picture lines up with the forms instead of needing translation.
 *
 * A patient with no birth date is left out rather than guessed into a band; {@link countUndated}
 * says how many, so the card can admit what it is not showing.
 */
export function getAgeDistribution(patients: Patient[]): Slice[] {
  const counts = new Array(BAND_EDGES.length + 1).fill(0) as number[];

  for (const patient of patients) {
    if (!patient.birthDate) continue;
    const age = dayjs().diff(dayjs(patient.birthDate), 'year');
    if (!Number.isFinite(age) || age < 0) continue;
    counts[bandIndex(age)] += 1;
  }

  return counts.map((value, index) => ({ label: bandLabel(index), value }));
}

const SEX_LABEL = { male: 'Мужчины', female: 'Женщины', unknown: 'Не указан' } as const;

/** Patients by sex, with the unrecorded ones counted rather than dropped. */
export function getSexDistribution(patients: Patient[]): Slice[] {
  const counts = { male: 0, female: 0, unknown: 0 };
  for (const patient of patients) {
    if (patient.sex === 'male') counts.male += 1;
    else if (patient.sex === 'female') counts.female += 1;
    else counts.unknown += 1;
  }

  return (Object.keys(counts) as (keyof typeof counts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => ({ label: SEX_LABEL[key], value: counts[key] }));
}

export function countUndated(patients: Patient[]): number {
  return patients.filter((patient) => !patient.birthDate || !dayjs(patient.birthDate).isValid()).length;
}

// ── Структура заболеваемости ────────────────────────────────────────────────

/**
 * Diagnoses ranked by how many visits carried them.
 *
 * Grouped by ICD code where a visit has one, and by the trimmed text where it does not: the same
 * disease typed twice with different wording is two rows otherwise, and the ranking stops meaning
 * anything. The label shown is the wording of the most recent visit in the group.
 */
export function getTopDiagnoses(patients: Patient[], limit = 8): BarItem[] {
  const groups = new Map<string, { label: string; code?: string; count: number; latest: string }>();

  for (const patient of patients) {
    for (const visit of patient.visits) {
      const text = visit.diagnosis.trim();
      if (!text) continue;

      const code = visit.diagnosisCode?.trim() || undefined;
      const key = code ? `code:${code}` : `text:${text.toLowerCase()}`;
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, { label: text, code, count: 1, latest: visit.date });
      } else {
        existing.count += 1;
        if (visit.date > existing.latest) {
          existing.latest = visit.date;
          existing.label = text;
        }
      }
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((group) => ({ label: group.label, value: group.count, code: group.code }));
}

// ── Чтение ──────────────────────────────────────────────────────────────────

export interface ReadingProgress {
  book: Book;
  /** 0–100. Reflowable formats store a fraction; paged ones a page number. */
  percent: number | null;
  readAt: string;
}

/**
 * The book to carry on with: the one read most recently, not the one added most recently.
 *
 * A book with no progress is skipped — it has not been opened, so there is nothing to continue,
 * and offering it would push the half-read book off the card.
 */
function progressOf(book: Book): ReadingProgress | null {
  if (!book.progress) return null;
  const percent =
    book.pageCount && book.pageCount > 0
      ? Math.min(100, Math.round((book.progress.location / book.pageCount) * 100))
      : book.pageCount === null
        ? Math.min(100, Math.round(book.progress.location * 100))
        : null;
  return { book, percent, readAt: book.progress.updatedAt };
}

export function getContinueReading(books: Book[]): ReadingProgress | null {
  return getReadingShelf(books)[0] ?? null;
}

/**
 * Начатые книги, недавняя первой.
 *
 * Порядок здесь — только «по времени», и он же задаёт, какая книга закреплена на карточке сверху.
 * Расстановку врача карточка накладывает поверх сама: закреплённая строка не должна зависеть от
 * того, как расставлены остальные, иначе «продолжить чтение» перестало бы означать последнюю
 * книгу.
 */
export function getReadingShelf(books: Book[]): ReadingProgress[] {
  return books
    .map(progressOf)
    .filter((entry): entry is ReadingProgress => entry !== null)
    .sort((a, b) => b.readAt.localeCompare(a.readAt));
}
