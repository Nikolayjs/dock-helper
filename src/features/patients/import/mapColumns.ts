import type { Cell } from './readTable';
import type { PatientSex } from '../types';

/**
 * Works out which column of a spreadsheet is which, and turns its cells into patient fields.
 *
 * Only the fields this app actually has are read. A registry carries far more — policy numbers,
 * addresses, attachment dates — and quietly inventing somewhere to put them would be worse than
 * leaving them behind, which is what the review screen shows the doctor before anything is saved.
 */

export type PatientField =
  | 'fullName'
  | 'lastName'
  | 'firstName'
  | 'middleName'
  | 'sex'
  | 'birthDate'
  | 'phone'
  | 'diagnosis'
  | 'diagnosisCode'
  | 'registeredDate';

export interface DraftPatient {
  fullName: string;
  sex: PatientSex | null;
  birthDate: string | null;
  phone: string;
  /** Present only when the file names a diagnosis; a single one for everybody is applied later. */
  diagnosis: string;
  diagnosisCode: string;
  /** The date the patient went on the register, when the file carries one. */
  registeredDate: string | null;
  /** 1-based row in the file, so a rejected row can be found in the original. */
  sourceRow: number;
}

/**
 * Header wordings seen in real registries. Matched as a prefix of the normalised heading, so
 * `Дата рождения пациента` finds `дата рожд` without needing its own entry.
 */
const HEADINGS: Array<{ field: PatientField; prefixes: string[] }> = [
  { field: 'fullName', prefixes: ['фио', 'ф и о', 'полное имя', 'пациент', 'фамилия имя отчество'] },
  { field: 'lastName', prefixes: ['фамилия'] },
  { field: 'firstName', prefixes: ['имя'] },
  { field: 'middleName', prefixes: ['отчество'] },
  { field: 'sex', prefixes: ['пол', 'sex', 'gender'] },
  { field: 'birthDate', prefixes: ['дата рожд', 'др', 'д р', 'дата рождения', 'birth', 'дата рожден'] },
  { field: 'phone', prefixes: ['телефон', 'тел', 'моб', 'контакт', 'номер тел', 'phone'] },
  { field: 'diagnosis', prefixes: ['диагноз', 'заболевание', 'нозология', 'основной диагноз'] },
  { field: 'diagnosisCode', prefixes: ['код мкб', 'мкб', 'мкб 10', 'код диагноза', 'шифр'] },
  { field: 'registeredDate', prefixes: ['дата постановки', 'постановка на учет', 'взят на учет', 'дата взятия', 'на учете с', 'дата учета'] },
];

function normalizeHeading(cell: Cell): string {
  return String(cell ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

function fieldForHeading(cell: Cell): PatientField | null {
  const text = normalizeHeading(cell);
  if (!text) return null;
  let best: { field: PatientField; length: number } | null = null;
  for (const { field, prefixes } of HEADINGS) {
    for (const prefix of prefixes) {
      // Longest matching prefix wins, so `Фамилия имя отчество` is one column rather than a surname.
      if ((text === prefix || text.startsWith(`${prefix} `)) && (!best || prefix.length > best.length)) {
        best = { field, length: prefix.length };
      }
    }
  }
  return best?.field ?? null;
}

export interface HeaderMatch {
  /** Index of the row holding the headings. */
  rowIndex: number;
  /** Column index per field; absent when the file has no such column. */
  columns: Partial<Record<PatientField, number>>;
}

/**
 * Finds the heading row. Registries routinely open with a title and a blank line or two, so the
 * first row is not reliably the header — the best-matching row within the opening block is.
 */
export function findHeader(rows: Cell[][]): HeaderMatch | null {
  let best: (HeaderMatch & { score: number }) | null = null;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 15); rowIndex++) {
    const columns: Partial<Record<PatientField, number>> = {};
    let score = 0;
    rows[rowIndex].forEach((cell, columnIndex) => {
      const field = fieldForHeading(cell);
      if (field && columns[field] === undefined) {
        columns[field] = columnIndex;
        score++;
      }
    });
    const namesSomething = columns.fullName !== undefined || columns.lastName !== undefined;
    if (namesSomething && (!best || score > best.score)) best = { rowIndex, columns, score };
  }

  return best ? { rowIndex: best.rowIndex, columns: best.columns } : null;
}

/**
 * The line a register ends with. `Итого:` sits in the surname column, has letters in it and passes
 * every other test — and became a patient in testing, complete with a telephone number of
 * `5 человек`. No real surname is any of these.
 *
 * The trailing guard is a lookahead rather than `\b`, which JavaScript defines over ASCII only and
 * which therefore never matches after a Cyrillic letter.
 */
const SUMMARY_ROW = /^(итого|всего|итог|сумма|количество|total|подпись|врач|составил)(?![а-яёa-z])/i;

const MALE = /^(м|муж|мужской|мужчина|m|male|1)$/i;
const FEMALE = /^(ж|жен|женский|женщина|f|female|w|2)$/i;

function parseSex(cell: Cell): PatientSex | null {
  const text = String(cell ?? '').trim().replace(/\.$/, '');
  if (MALE.test(text)) return 'male';
  if (FEMALE.test(text)) return 'female';
  return null;
}

/** Days between the Excel epoch (1899-12-30, quirk included) and the Unix epoch. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

function isoFromParts(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Round-tripped through UTC to reject the impossible: 31 February arrives as 2 or 3 March.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A spreadsheet date is a calendar day with no time and no zone, and the reader hands it over as
 * UTC midnight. Reading it back with local getters would move every birthday a day earlier for
 * anyone west of Greenwich, so the UTC parts are the only ones that mean anything here.
 */
function isoFromUtcDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Двузначный год — это год, который уже наступил.
 *
 * Правило одно на все колонки реестра: прибавить 2000, а если вышло будущее — вычесть сто. И день
 * рождения, и дата постановки на учёт — события прошлого, поэтому `30` — это 1930, `05` — 2005, а
 * `26` в 2026 году — это и правда 2026.
 *
 * Прежний порог «больше тридцати — значит девятнадцатый век» давал пациенту 1930 года рождения дату
 * **2030**, а 1929-му — 2029. Это ровно та когорта, из которой состоит диспансерная группа, и
 * дальше эта дата уходит в расчёт возраста и в выбор референсных интервалов анализатора: пациент
 * получал отрицательный возраст и чужие нормы. Порог, привязанный к числу, устаревает сам собой —
 * этот привязан к сегодняшнему году.
 */
function expandTwoDigitYear(value: number): number {
  const asRecent = 2000 + value;
  return asRecent <= new Date().getFullYear() ? asRecent : asRecent - 100;
}

export function parseDateCell(cell: Cell): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (cell instanceof Date) return isoFromUtcDate(cell);
  // A date-formatted cell read as a plain number is a serial count of days from the Excel epoch.
  if (typeof cell === 'number') {
    return isoFromUtcDate(new Date(Math.round((cell - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY)));
  }

  const text = String(cell).trim();
  const dmy = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? expandTwoDigitYear(Number(y)) : Number(y);
    return isoFromParts(year, Number(m), Number(d));
  }
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return isoFromParts(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
  return null;
}

function cellText(row: Cell[], index: number | undefined): string {
  if (index === undefined) return '';
  const value = row[index];
  return value === null || value === undefined ? '' : String(value).trim();
}

export interface MappedRows {
  patients: DraftPatient[];
  /** Rows that carried no usable name — usually totals, section headings or blank separators. */
  skippedRows: number[];
}

export function mapRows(rows: Cell[][], header: HeaderMatch): MappedRows {
  const { columns } = header;
  const patients: DraftPatient[] = [];
  const skippedRows: number[] = [];

  for (let i = header.rowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => cell === null || cell === '')) continue;

    // Either one full-name column, or the three-column split every hospital registry uses.
    const fullName = (
      cellText(row, columns.fullName) ||
      [cellText(row, columns.lastName), cellText(row, columns.firstName), cellText(row, columns.middleName)]
        .filter(Boolean)
        .join(' ')
    )
      .replace(/\s+/g, ' ')
      .trim();

    // A name needs a letter in it: `12` and a stray dash are not people.
    if (!fullName || !/[а-яёa-z]/i.test(fullName) || SUMMARY_ROW.test(fullName)) {
      skippedRows.push(i + 1);
      continue;
    }

    patients.push({
      fullName,
      sex: parseSex(row[columns.sex ?? -1] ?? null),
      birthDate: parseDateCell(row[columns.birthDate ?? -1] ?? null),
      phone: cellText(row, columns.phone),
      diagnosis: cellText(row, columns.diagnosis),
      diagnosisCode: cellText(row, columns.diagnosisCode),
      registeredDate: parseDateCell(row[columns.registeredDate ?? -1] ?? null),
      sourceRow: i + 1,
    });
  }

  return { patients, skippedRows };
}
