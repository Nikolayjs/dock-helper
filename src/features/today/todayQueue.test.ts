import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';

import { EMPTY_PATIENT_CONSTANTS } from '../patients/types';
import type { DispensaryRecord, Patient, PatientVisit } from '../patients/types';
import { getSeenToday, getTodayQueue } from './todayQueue';

const TODAY = dayjs('2026-08-31');
const iso = (offset: number) => TODAY.add(offset, 'day').format('YYYY-MM-DD');

function patient(id: string, fullName: string, extra: Partial<Patient> = {}): Patient {
  return {
    id,
    fullName,
    sex: null,
    birthDate: null,
    phone: '',
    reminderDate: null,
    reminderNote: '',
    ...EMPTY_PATIENT_CONSTANTS,
    visits: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function visit(date: string, extra: Partial<PatientVisit> = {}): PatientVisit {
  return {
    id: `v-${date}`,
    date,
    diagnosis: '',
    note: '',
    referralCategory: null,
    referralDestination: '',
    createdAt: `${date}T09:00:00.000Z`,
    ...extra,
  };
}

function record(patientId: string, nextVisitDate: string | null, extra: Partial<DispensaryRecord> = {}): DispensaryRecord {
  return {
    id: `d-${patientId}`,
    patientId,
    diagnosis: 'Гипертоническая болезнь',
    registeredDate: '2026-01-01',
    nextVisitDate,
    status: 'active',
    removedDate: null,
    removedReason: null,
    observations: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

describe('кого ждём сегодня', () => {
  it('берёт и напоминание, и диспансерную явку', () => {
    const a = patient('a', 'Абрамов', { reminderDate: iso(0), reminderNote: 'Контроль АД' });
    const b = patient('b', 'Борисов');
    const queue = getTodayQueue([a, b], [record('b', iso(0))], TODAY);
    expect(queue.map((entry) => [entry.patient.id, entry.reasons[0].kind])).toEqual([
      ['a', 'reminder'],
      ['b', 'dispensary'],
    ]);
  });

  // Список, где один человек стоит дважды, приводит к двум звонкам одному человеку.
  it('одна строка на человека, даже когда причин две', () => {
    const a = patient('a', 'Абрамов', { reminderDate: iso(0), reminderNote: 'Контроль АД' });
    const queue = getTodayQueue([a], [record('a', iso(0))], TODAY);
    expect(queue).toHaveLength(1);
    expect(queue[0].reasons.map((r) => r.kind)).toEqual(['reminder', 'dispensary']);
  });

  // «Мой день» — это то, что надо сделать сегодня, а пропущенная вчера явка ею и является.
  it('просроченное входит наравне с сегодняшним и стоит выше', () => {
    const late = patient('late', 'Просроченный', { reminderDate: iso(-9) });
    const now = patient('now', 'Сегодняшний', { reminderDate: iso(0) });
    const queue = getTodayQueue([now, late], [], TODAY);
    expect(queue.map((e) => [e.patient.id, e.daysLate])).toEqual([
      ['late', 9],
      ['now', 0],
    ]);
  });

  it('завтрашнее не показывается', () => {
    const soon = patient('soon', 'Завтрашний', { reminderDate: iso(1) });
    expect(getTodayQueue([soon], [record('soon', iso(3))], TODAY)).toEqual([]);
  });

  // Иначе список не убывал бы к концу приёма, а в этом весь его смысл.
  it('принятый сегодня из списка уходит', () => {
    const a = patient('a', 'Абрамов', { reminderDate: iso(-2), visits: [visit(iso(0))] });
    expect(getTodayQueue([a], [record('a', iso(-2))], TODAY)).toEqual([]);
  });

  it('вчерашний визит из списка не убирает', () => {
    const a = patient('a', 'Абрамов', { reminderDate: iso(-2), visits: [visit(iso(-1))] });
    expect(getTodayQueue([a], [], TODAY)).toHaveLength(1);
  });

  // Позвать некого; в диспансерном отчёте такая карта остаётся строкой «Пациент удалён».
  it('карта удалённого пациента в список не попадает', () => {
    expect(getTodayQueue([], [record('ghost', iso(-5))], TODAY)).toEqual([]);
  });

  it('снятая с учёта карта не зовёт на явку', () => {
    const a = patient('a', 'Абрамов');
    const removed = record('a', iso(-5), { status: 'removed', removedDate: iso(-3), removedReason: 'recovered' });
    expect(getTodayQueue([a], [removed], TODAY)).toEqual([]);
  });
});

describe('кого уже приняли сегодня', () => {
  it('берёт визиты сегодняшним числом, свежие сверху', () => {
    const a = patient('a', 'Абрамов', {
      visits: [
        visit(iso(0), { id: 'ранний', createdAt: `${iso(0)}T09:00:00.000Z` }),
        visit(iso(0), { id: 'поздний', createdAt: `${iso(0)}T15:00:00.000Z` }),
        visit(iso(-1)),
      ],
    });
    expect(getSeenToday([a], TODAY).map((s) => s.visit.id)).toEqual(['поздний', 'ранний']);
  });

  it('без сегодняшних визитов список пуст', () => {
    expect(getSeenToday([patient('a', 'Абрамов', { visits: [visit(iso(-1))] })], TODAY)).toEqual([]);
  });
});
