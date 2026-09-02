import { describe, expect, it } from 'vitest';

import { findHeader, mapRows } from './mapColumns';
import { patientsWorkbook } from './exportPatients';
import type { Patient, PatientVisit } from '../types';

/**
 * Главная проверка выгрузки — **круговая**, как у .docx и .xlsx: файл, который мы отдаём, обязан
 * пониматься нашим же импортом. Иначе выгрузка выглядит резервной копией, не будучи ею.
 */
const patient = (overrides: Partial<Patient>): Patient => ({
  id: 'p1',
  fullName: 'Иванов Иван Иванович',
  sex: 'male',
  birthDate: '1970-03-04',
  phone: '+7 900 000-00-00',
  reminderDate: null,
  reminderNote: '',
  heightCm: 178,
  weightKg: 82,
  measuredAt: '2026-09-01',
  allergies: 'пенициллины',
  insurancePolicy: '1234567890123456',
  district: '3',
  address: 'Екатеринбург, Ленина, 1',
  visits: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const visit = (date: string, diagnosis: string): PatientVisit => ({
  id: `v-${date}`,
  date,
  diagnosis,
  diagnosisCode: 'J18.9',
  note: 'заметка',
  referralCategory: null,
  referralDestination: '',
  createdAt: `${date}T09:00:00.000Z`,
});


describe('выгрузка картотеки', () => {
  it('заголовки листа пациентов понимает собственный импорт', () => {
    const [patients] = patientsWorkbook([patient({})]);
    const rows = [patients.columns, ...patients.rows];
    const header = findHeader(rows);
    expect(header).not.toBeNull();
    const mapped = mapRows(rows, header!);

    expect(mapped.patients).toHaveLength(1);
    expect(mapped.patients[0]).toMatchObject({
      fullName: 'Иванов Иван Иванович',
      sex: 'male',
      birthDate: '1970-03-04',
      insurancePolicy: '1234567890123456',
      district: '3',
      address: 'Екатеринбург, Ленина, 1',
    });
  });

  it('в строке пациента стоит его последний диагноз, а не первый попавшийся визит', () => {
    const [patients] = patientsWorkbook([
      patient({ visits: [visit('2025-01-10', 'Старый'), visit('2026-08-30', 'Свежий')] }),
    ]);
    expect(patients.rows[0]).toContain('Свежий');
  });

  it('визиты идут вторым листом — все и с датами', () => {
    const [, visits] = patientsWorkbook([
      patient({ visits: [visit('2025-01-10', 'Старый'), visit('2026-08-30', 'Свежий')] }),
    ]);
    expect(visits.sheetName).toBe('Визиты');
    expect(visits.rows).toHaveLength(2);
    // Сверху последний приём — тот же порядок, что и в карточке пациента.
    expect(visits.rows[0][2]).toBe('30.08.2026');
    expect(visits.rows[1][2]).toBe('10.01.2025');
  });

  it('пустая картотека — пустые листы, а не отказ', () => {
    const sheets = patientsWorkbook([]);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].rows).toEqual([]);
  });
});
