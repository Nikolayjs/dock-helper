import dayjs from 'dayjs';

import { lastVisitOf, sortedVisits } from '../utils';
import type { Patient } from '../types';
import type { XlsxInput } from '../../../lib/xlsx/writeXlsx';

/**
 * Выгрузка картотеки в .xlsx — обратная операция к загрузке базы.
 *
 * Загрузить чужой реестр приложение умело, а отдать свой — нет, и для медицинского продукта это
 * условие доверия: врач должен видеть, что его записи принадлежат ему, а не нам. Отсюда два
 * требования, из которых всё и следует:
 *
 * - **Заголовки те же, что понимает импорт** (`mapColumns.ts`): выгруженный файл обязан загружаться
 *   обратно — это и переезд, и проверка самой выгрузки. Поэтому «ФИО», «Пол», «Дата рождения», а не
 *   свои названия.
 * - **Визиты — вторым листом.** В одном листе пришлось бы либо повторять пациента на каждый приём,
 *   либо потерять приёмы; ни то, ни другое резервной копией не является. Импорт читает первый лист,
 *   второй остаётся историей для человека — приёмы через реестр не переносятся в принципе, у него
 *   одна строка на пациента.
 *
 * Даты пишутся как в реестрах, `ДД.ММ.ГГГГ`: их и читает импорт, и в них же их печатают на бумаге.
 */
const PATIENT_COLUMNS = [
  'ФИО',
  'Пол',
  'Дата рождения',
  'Телефон',
  'Полис',
  'Участок',
  'Адрес',
  'Диагноз',
  'Код МКБ',
  'Аллергии',
  'Рост, см',
  'Вес, кг',
  'Визитов',
  'Последний визит',
  'Напоминание',
];

const VISIT_COLUMNS = ['ФИО', 'Дата рождения', 'Дата приёма', 'Диагноз', 'Код МКБ', 'Направление', 'Куда направлен', 'Заметка'];

const SEX = { male: 'Мужской', female: 'Женский' } as const;

function date(value: string | null | undefined): string {
  return value ? dayjs(value).format('DD.MM.YYYY') : '';
}

function number(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export function patientsWorkbook(patients: Patient[]): XlsxInput[] {
  const rows = patients.map((patient) => {
    const last = lastVisitOf(patient);
    return [
      patient.fullName,
      patient.sex ? SEX[patient.sex] : '',
      date(patient.birthDate),
      patient.phone,
      patient.insurancePolicy ?? '',
      patient.district ?? '',
      patient.address ?? '',
      last?.diagnosis ?? '',
      last?.diagnosisCode ?? '',
      patient.allergies ?? '',
      number(patient.heightCm),
      number(patient.weightKg),
      String(patient.visits.length),
      date(last?.date),
      date(patient.reminderDate),
    ];
  });

  const visits = patients.flatMap((patient) =>
    sortedVisits(patient.visits).map((visit) => [
      patient.fullName,
      date(patient.birthDate),
      date(visit.date),
      visit.diagnosis,
      visit.diagnosisCode ?? '',
      visit.referralCategory ?? '',
      visit.referralDestination,
      visit.note,
    ]),
  );

  return [
    { sheetName: 'Пациенты', columns: PATIENT_COLUMNS, rows },
    { sheetName: 'Визиты', columns: VISIT_COLUMNS, rows: visits },
  ];
}
