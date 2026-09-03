import { describe, expect, it } from 'vitest';

import { buildDispensaryReport } from './dispensaryReport';
import { computeDispensaryStats, computeStatsByDiagnosis } from './dispensaryStats';
import { EMPTY_PATIENT_CONSTANTS } from './types';
import type { DispensaryRecord, PatientSummary } from './types';

/**
 * Годовой отчёт, уходящий в Excel.
 *
 * Главное здесь — **сходимость**: число строк реестра обязано совпадать с числом карт, попавших в
 * итог. Отчёт, у которого итог говорит одно, а список строк другое, приходится пересчитывать
 * вручную — то есть возвращает ровно ту работу, ради ухода от которой он и написан.
 */

const PERIOD = { start: '2026-01-01', end: '2026-12-31' };

const patient = (id: string, fullName: string, sex: 'male' | 'female', birthDate: string | null): PatientSummary => ({
  id,
  fullName,
  sex,
  birthDate,
  phone: '',
  reminderDate: null,
  reminderNote: '',
  ...EMPTY_PATIENT_CONSTANTS,
  lastVisit: null,
  visitCount: 0,
  createdAt: '',
  updatedAt: '',
});

const record = (id: string, patientId: string, overrides: Partial<DispensaryRecord> = {}): DispensaryRecord => ({
  id,
  patientId,
  diagnosis: 'Гипертоническая болезнь',
  diagnosisCode: 'I11.9',
  registeredDate: '2024-03-15',
  nextVisitDate: null,
  status: 'active',
  removedDate: null,
  removedReason: null,
  observations: [],
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

function report(records: DispensaryRecord[], patients: PatientSummary[], hideNames = false) {
  const patientsById = new Map(patients.map((p) => [p.id, p]));
  return buildDispensaryReport({
    periodStart: PERIOD.start,
    periodEnd: PERIOD.end,
    filters: 'без отбора, все карты учёта',
    stats: computeDispensaryStats(records, PERIOD.start, PERIOD.end),
    byDiagnosis: computeStatsByDiagnosis(records, PERIOD.start, PERIOD.end),
    records,
    patientsById,
    labelOf: (r) => r.diagnosis,
    codeOf: (r) => r.diagnosisCode,
    hideNames,
  });
}

const PATIENTS = [
  patient('p1', 'Иванов Иван Иванович', 'male', '1958-11-07'),
  patient('p2', 'Петрова Мария Сергеевна', 'female', '1990-05-20'),
];
const RECORDS = [
  record('r1', 'p1'),
  record('r2', 'p2', { diagnosis: 'Сахарный диабет 2 типа', diagnosisCode: 'E11.9' }),
];

describe('шапка отчёта', () => {
  it('называет период и отбор', () => {
    const sheet = report(RECORDS, PATIENTS);
    expect(sheet.columns[0]).toBe('Период: 01.01.2026 — 31.12.2026');
    expect(sheet.rows[0]?.[0]).toBe('Отбор: без отбора, все карты учёта');
  });

  it('имя листа называет год отчёта', () => {
    expect(report(RECORDS, PATIENTS).sheetName).toBe('Диспансеризация 2026');
  });
});

describe('разделы', () => {
  const sheet = report(RECORDS, PATIENTS);
  const flat = [sheet.columns, ...sheet.rows];
  const at = (title: string) => flat.findIndex((row) => row[0] === title);

  it('идут в том же порядке, что на экране', () => {
    expect(at('Итоги')).toBeGreaterThan(0);
    expect(at('По диагнозам')).toBeGreaterThan(at('Итоги'));
    expect(at('Реестр пациентов')).toBeGreaterThan(at('По диагнозам'));
  });

  it('итоги — одна строка под своими заголовками', () => {
    const header = flat[at('Итоги') + 1] ?? [];
    const values = flat[at('Итоги') + 2] ?? [];
    expect(header[0]).toBe('Состояло');
    expect(values[4]).toBe('2'); // «Состоит» — обе карты активны
  });

  it('по диагнозам — строка на болезнь', () => {
    const start = at('По диагнозам') + 2;
    expect(flat[start]?.[0]).toBeTruthy();
    expect(flat[start + 1]?.[0]).toBeTruthy();
    expect(flat[start + 2]?.[0]).toBe('');
  });
});

describe('реестр', () => {
  it('число строк сходится с числом карт', () => {
    const sheet = report(RECORDS, PATIENTS);
    const flat = [sheet.columns, ...sheet.rows];
    const start = flat.findIndex((row) => row[0] === 'Реестр пациентов') + 2;
    const rows = flat.slice(start).filter((row) => row[0] !== '');
    expect(rows).toHaveLength(RECORDS.length);
  });

  it('возраст считается на конец периода, а не на сегодня', () => {
    const sheet = report(RECORDS, PATIENTS);
    const flat = [sheet.columns, ...sheet.rows];
    const start = flat.findIndex((row) => row[0] === 'Реестр пациентов') + 2;
    // 07.11.1958 → на 31.12.2026 исполнилось 68.
    expect(flat[start]?.[3]).toBe('68');
  });

  it('удалённый пациент остаётся строкой, а не пропадает', () => {
    // Иначе итог говорил бы одно, а число строк — другое.
    const sheet = report([record('r3', 'нет-такого')], []);
    const flat = [sheet.columns, ...sheet.rows];
    const start = flat.findIndex((row) => row[0] === 'Реестр пациентов') + 2;
    expect(flat[start]?.[1]).toBe('Пациент удалён');
  });

  it('«скрыть имена» убирает столбец, а не заменяет его пустотой', () => {
    const sheet = report(RECORDS, PATIENTS, true);
    const flat = [sheet.columns, ...sheet.rows];
    const title = flat.findIndex((row) => row[0] === 'Карты учёта');
    expect(title).toBeGreaterThan(0);
    expect(flat[title + 1]?.slice(0, 4)).toEqual(['№', 'Пол', 'Возраст', 'Диагноз']);
  });

  it('снятая карта называет причину', () => {
    const removed = [record('r4', 'p1', { status: 'removed', removedDate: '2026-06-01', removedReason: 'recovered' })];
    const sheet = report(removed, PATIENTS);
    const flat = [sheet.columns, ...sheet.rows];
    const start = flat.findIndex((row) => row[0] === 'Реестр пациентов') + 2;
    expect(flat[start]?.[7]).toContain('Снят');
  });
});

describe('форма листа', () => {
  it('все строки одной ширины — иначе Excel растянет заголовок раздела', () => {
    const sheet = report(RECORDS, PATIENTS);
    const widths = new Set([sheet.columns.length, ...sheet.rows.map((row) => row.length)]);
    expect(widths.size).toBe(1);
  });
});
