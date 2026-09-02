import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countUndated,
  getAgeDistribution,
  getContinueReading,
  getReadingShelf,
  getDispensaryQueue,
  getLapsedPatients,
  getMonthlyVisitCount,
  getSexDistribution,
  getTopDiagnoses,
  getVisitLoad,
} from './practice';
import type { Book } from '../library/types';
import { EMPTY_PATIENT_CONSTANTS } from '../patients/types';
import type { DispensaryRecord, Patient, PatientVisit } from '../patients/types';

/** Every expectation below is written against this date. */
const TODAY = '2026-08-26';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T10:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

function visit(date: string, extra: Partial<PatientVisit> = {}): PatientVisit {
  return {
    id: `v-${date}-${extra.diagnosis ?? ''}`,
    date,
    diagnosis: '',
    note: '',
    referralCategory: null,
    referralDestination: '',
    createdAt: date,
    ...extra,
  };
}

function patient(id: string, extra: Partial<Patient> = {}): Patient {
  return {
    id,
    fullName: `Пациент ${id}`,
    sex: null,
    birthDate: null,
    phone: '',
    reminderDate: null,
    ...EMPTY_PATIENT_CONSTANTS,
    reminderNote: '',
    visits: [],
    createdAt: TODAY,
    updatedAt: TODAY,
    ...extra,
  };
}

function record(id: string, extra: Partial<DispensaryRecord> = {}): DispensaryRecord {
  return {
    id,
    patientId: id,
    diagnosis: 'Гипертоническая болезнь',
    registeredDate: '2025-01-01',
    nextVisitDate: null,
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...extra,
  };
}

describe('getDispensaryQueue', () => {
  it('splits by the date, counting today as due rather than late', () => {
    const records = [
      record('late', { nextVisitDate: '2026-08-20' }),
      record('now', { nextVisitDate: TODAY }),
      record('soon', { nextVisitDate: '2026-08-30' }),
    ];
    const { overdue, soon } = getDispensaryQueue(records, []);

    expect(overdue.map((d) => d.record.id)).toEqual(['late']);
    expect(overdue[0].daysLate).toBe(6);
    expect(soon.map((d) => d.record.id)).toEqual(['now', 'soon']);
  });

  it('ignores anything beyond the horizon', () => {
    const { soon } = getDispensaryQueue([record('far', { nextVisitDate: '2026-10-01' })], []);
    expect(soon).toHaveLength(0);
  });

  it('leaves out records removed from the registry', () => {
    // A removed record keeps its next-visit date; counting it would fill the queue with
    // people the doctor deliberately stopped watching.
    const records = [record('gone', { nextVisitDate: '2026-08-01', status: 'removed' })];
    expect(getDispensaryQueue(records, []).overdue).toHaveLength(0);
  });

  it('leaves out records with no follow-up date planned', () => {
    expect(getDispensaryQueue([record('open')], []).overdue).toHaveLength(0);
  });

  it('puts the most overdue first and attaches the patient', () => {
    const records = [
      record('a', { patientId: 'p1', nextVisitDate: '2026-08-25' }),
      record('b', { patientId: 'p2', nextVisitDate: '2026-06-01' }),
    ];
    const { overdue } = getDispensaryQueue(records, [patient('p1'), patient('p2')]);

    expect(overdue.map((d) => d.record.id)).toEqual(['b', 'a']);
    expect(overdue[0].patient?.id).toBe('p2');
  });

  it('survives a record whose patient was deleted', () => {
    const { overdue } = getDispensaryQueue([record('orphan', { patientId: 'gone', nextVisitDate: '2026-01-01' })], []);
    expect(overdue[0].patient).toBeUndefined();
  });
});

describe('getMonthlyVisitCount', () => {
  it('counts this month against the previous one', () => {
    const patients = [
      patient('a', { visits: [visit('2026-08-02'), visit('2026-08-20'), visit('2026-07-15')] }),
      patient('b', { visits: [visit('2026-07-01'), visit('2026-07-02')] }),
    ];
    expect(getMonthlyVisitCount(patients)).toEqual({ current: 2, previous: 3, deltaPercent: -33 });
  });

  it('reports no percentage when the previous month was empty', () => {
    const result = getMonthlyVisitCount([patient('a', { visits: [visit('2026-08-05')] })]);
    expect(result).toEqual({ current: 1, previous: 0, deltaPercent: null });
  });
});

describe('getLapsedPatients', () => {
  it('finds those who used to come and stopped', () => {
    const patients = [
      patient('old', { visits: [visit('2024-01-10')] }),
      patient('recent', { visits: [visit('2026-08-01')] }),
    ];
    const lapsed = getLapsedPatients(patients);

    expect(lapsed.map((l) => l.patient.id)).toEqual(['old']);
    expect(lapsed[0].monthsSince).toBe(31);
  });

  it('takes the latest visit, not the first one stored', () => {
    const patients = [patient('a', { visits: [visit('2020-01-01'), visit('2026-08-01')] })];
    expect(getLapsedPatients(patients)).toHaveLength(0);
  });

  it('leaves out a patient who has never been seen at all', () => {
    // Entered but never seen is a different situation and a different action.
    expect(getLapsedPatients([patient('never')])).toHaveLength(0);
  });
});

describe('getVisitLoad', () => {
  it('returns one point per bucket and keeps empty ones', () => {
    const patients = [patient('a', { visits: [visit(TODAY), visit(TODAY)] })];

    const week = getVisitLoad(patients, 'week');
    expect(week).toHaveLength(7);
    expect(week[6].visits).toBe(2);
    expect(week.slice(0, 6).every((point) => point.visits === 0)).toBe(true);

    expect(getVisitLoad(patients, 'year')).toHaveLength(12);
    expect(getVisitLoad(patients, 'month')).toHaveLength(30);
  });

  it('buckets a year by month', () => {
    const patients = [patient('a', { visits: [visit('2026-08-01'), visit('2026-08-26'), visit('2026-07-30')] })];
    const year = getVisitLoad(patients, 'year');
    expect(year[11].visits).toBe(2);
    expect(year[10].visits).toBe(1);
  });
});

describe('getAgeDistribution', () => {
  it('puts each age in its band, on the boundaries too', () => {
    const patients = [
      patient('child', { birthDate: '2009-08-27' }), // 16
      patient('just18', { birthDate: '2008-08-26' }), // 18 сегодня
      patient('sixtyeight', { birthDate: '1957-08-27' }), // 68
      patient('seventy', { birthDate: '1956-08-26' }), // 70 сегодня
    ];
    const byLabel = Object.fromEntries(getAgeDistribution(patients).map((band) => [band.label, band.value]));

    expect(byLabel['0–17']).toBe(1);
    expect(byLabel['18–29']).toBe(1);
    expect(byLabel['60–69']).toBe(1);
    expect(byLabel['70+']).toBe(1);
  });

  it('keeps every band, including the empty ones', () => {
    // Пустая полоса — это ответ: таких пациентов нет. Выкинуть её значило бы соврать о форме.
    const bands = getAgeDistribution([patient('a', { birthDate: '1980-01-01' })]);
    expect(bands).toHaveLength(7);
    expect(bands.filter((band) => band.value === 0)).toHaveLength(6);
  });

  it('leaves out a patient with no birth date rather than inventing a band', () => {
    const patients = [patient('nodate'), patient('dated', { birthDate: '1980-01-01' })];
    const total = getAgeDistribution(patients).reduce((sum, band) => sum + band.value, 0);

    expect(total).toBe(1);
    expect(countUndated(patients)).toBe(1);
  });
});

describe('getSexDistribution', () => {
  it('counts the unrecorded rather than dropping them', () => {
    const patients = [
      patient('m', { sex: 'male' }),
      patient('f1', { sex: 'female' }),
      patient('f2', { sex: 'female' }),
      patient('unknown'),
    ];
    expect(getSexDistribution(patients)).toEqual([
      { label: 'Мужчины', value: 1 },
      { label: 'Женщины', value: 2 },
      { label: 'Не указан', value: 1 },
    ]);
  });

  it('omits a category nobody falls into', () => {
    expect(getSexDistribution([patient('m', { sex: 'male' })])).toEqual([{ label: 'Мужчины', value: 1 }]);
  });
});

describe('getContinueReading', () => {
  const book = (id: string, extra: Partial<Book> = {}): Book => ({
    id,
    format: 'pdf',
    storage: 'device',
    sha256: `sha-${id}`,
    sourceUrl: null,
    title: `Книга ${id}`,
    author: '',
    description: '',
    coverDataUrl: null,
    fileName: `${id}.pdf`,
    fileSize: 1,
    pageCount: null,
    progress: null,
    addedAt: TODAY,
    updatedAt: TODAY,
    ...extra,
  });

  it('takes the book read last, not the one added last', () => {
    const books = [
      book('old', { progress: { location: 10, updatedAt: '2026-08-01T10:00:00Z' } }),
      book('fresh', { progress: { location: 3, updatedAt: '2026-08-25T10:00:00Z' } }),
      book('never'),
    ];
    expect(getContinueReading(books)?.book.id).toBe('fresh');
  });

  it('skips books that were never opened', () => {
    expect(getContinueReading([book('a'), book('b')])).toBeNull();
  });

  it('reads a paged book as a share of its pages', () => {
    const books = [book('pdf', { pageCount: 200, progress: { location: 50, updatedAt: '2026-08-20T10:00:00Z' } })];
    expect(getContinueReading(books)?.percent).toBe(25);
  });

  it('reads a reflowable book straight from its fraction', () => {
    const books = [book('docx', { format: 'docx', progress: { location: 0.42, updatedAt: '2026-08-20T10:00:00Z' } })];
    expect(getContinueReading(books)?.percent).toBe(42);
  });

  it('полка идёт от недавней книги к давней и не включает неоткрытые', () => {
    // Порядок полки задаёт, какая книга закреплена сверху карточки, — именно поэтому он «по
    // времени», а не по названию и не по тому, как книги легли в базу.
    const books = [
      book('middle', { progress: { location: 5, updatedAt: '2026-08-10T10:00:00Z' } }),
      book('never'),
      book('newest', { progress: { location: 5, updatedAt: '2026-08-25T10:00:00Z' } }),
      book('oldest', { progress: { location: 5, updatedAt: '2026-08-01T10:00:00Z' } }),
    ];
    expect(getReadingShelf(books).map((entry) => entry.book.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('пустая полка, когда ни одна книга не открыта', () => {
    expect(getReadingShelf([book('a'), book('b')])).toEqual([]);
  });
});

describe('getTopDiagnoses', () => {
  it('ranks by how many visits carried the diagnosis', () => {
    const patients = [
      patient('a', { visits: [visit('2026-01-01', { diagnosis: 'ОРВИ' }), visit('2026-02-01', { diagnosis: 'ОРВИ' })] }),
      patient('b', { visits: [visit('2026-03-01', { diagnosis: 'Гастрит' })] }),
    ];
    expect(getTopDiagnoses(patients)).toEqual([
      { label: 'ОРВИ', value: 2, code: undefined },
      { label: 'Гастрит', value: 1, code: undefined },
    ]);
  });

  it('groups the same ICD code typed differently, showing the latest wording', () => {
    // Without this the ranking splits one disease across every way it was ever typed.
    const patients = [
      patient('a', {
        visits: [
          visit('2026-01-01', { diagnosis: 'Гипертоническая болезнь', diagnosisCode: 'I10' }),
          visit('2026-05-01', { diagnosis: 'Артериальная гипертензия', diagnosisCode: 'I10' }),
        ],
      }),
    ];
    expect(getTopDiagnoses(patients)).toEqual([{ label: 'Артериальная гипертензия', value: 2, code: 'I10' }]);
  });

  it('skips visits with no diagnosis and honours the limit', () => {
    const patients = [
      patient('a', {
        visits: [
          visit('2026-01-01', { diagnosis: '' }),
          visit('2026-01-02', { diagnosis: 'А' }),
          visit('2026-01-03', { diagnosis: 'Б' }),
          visit('2026-01-04', { diagnosis: 'В' }),
        ],
      }),
    ];
    expect(getTopDiagnoses(patients, 2)).toHaveLength(2);
  });
});
