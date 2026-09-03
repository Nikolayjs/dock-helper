import dayjs from 'dayjs';

import type { XlsxInput } from '../../lib/xlsx/writeXlsx';
import type { DiagnosisStats, DispensaryStats } from './dispensaryStats';
import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import type { DispensaryRecord, PatientSummary } from './types';

/**
 * Годовой отчёт по диспансерному учёту — в таблицу Excel.
 *
 * До этого его переписывали с экрана руками. Считается всё то же самое, что показано на странице, и
 * **из того же отфильтрованного набора**: отчёт, посчитанный по другому набору, чем видит врач, —
 * это отчёт, за который потом отвечать.
 *
 * Один лист, а не три: подпись раздела идёт строкой, потому что лист с именем «Итоги» и лист
 * «По диагнозам» в проверяющей инстанции всё равно печатают подряд, а объединять их обратно
 * приходится руками. Пустые строки между разделами — то же самое, что делает человек с бумагой.
 */
export interface DispensaryReportInput {
  periodStart: string;
  periodEnd: string;
  /** Как отобран набор: строкой, потому что читатель отчёта должен видеть, что в него вошло. */
  filters: string;
  stats: DispensaryStats;
  byDiagnosis: DiagnosisStats[];
  records: DispensaryRecord[];
  patientsById: Map<string, PatientSummary>;
  /** Название болезни по карте: та же функция, что рисует строки на экране. */
  labelOf: (record: DispensaryRecord) => string;
  codeOf: (record: DispensaryRecord) => string | undefined;
  /** Реестр без фамилий: разрез нагрузки показывают тем, кому имена знать незачем. */
  hideNames: boolean;
}

const SUMMARY_COLUMNS = [
  'Состояло',
  'Взято',
  'Снято: выздоровление',
  'Снято: выбыл',
  'Состоит',
  'Ухудшение',
  'Улучшение',
  'Выздоровление',
  'Без перемен',
  'Смертность',
  'ОВЛ',
  'Санатории',
  'Лагеря/базы отдыха',
];

function summaryRow(stats: DispensaryStats): string[] {
  return [
    stats.consisted,
    stats.taken,
    stats.recoveredRemoved,
    stats.leftRemoved,
    stats.consists,
    stats.effectiveness.worsened,
    stats.effectiveness.improved,
    stats.effectiveness.recovered,
    stats.effectiveness.unchanged,
    stats.effectiveness.death,
    stats.ovl,
    stats.sanatorium,
    stats.campRest,
  ].map(String);
}

/** Возраст на конец периода: пересчёт прошлогоднего отчёта обязан дать прошлогодний ответ. */
function ageAt(birthDate: string | null, asOf: string): string {
  if (!birthDate) return '';
  const age = dayjs(asOf).diff(dayjs(birthDate), 'year');
  return age >= 0 ? String(age) : '';
}

export function buildDispensaryReport(input: DispensaryReportInput): XlsxInput {
  const { periodStart, periodEnd, filters, stats, byDiagnosis, records, patientsById, labelOf, codeOf, hideNames } = input;
  const period = `${dayjs(periodStart).format('DD.MM.YYYY')} — ${dayjs(periodEnd).format('DD.MM.YYYY')}`;

  // Ширина листа задаётся самой широкой таблицей: короткие строки дополняются пустыми ячейками,
  // иначе Excel растянет заголовок раздела на все столбцы и таблица под ним поедет.
  const width = Math.max(SUMMARY_COLUMNS.length + 2, hideNames ? 7 : 8);
  const pad = (row: string[]) => [...row, ...Array<string>(Math.max(0, width - row.length)).fill('')];

  const rows: string[][] = [];
  const push = (row: string[]) => rows.push(pad(row));

  push([`Период: ${period}`]);
  push([`Отбор: ${filters}`]);
  push([]);

  push(['Итоги']);
  push(SUMMARY_COLUMNS);
  push(summaryRow(stats));
  push([]);

  push(['По диагнозам']);
  push(['Диагноз', 'Код МКБ', ...SUMMARY_COLUMNS]);
  for (const line of byDiagnosis) {
    push([line.diagnosis, line.diagnosisCode ?? '', ...summaryRow(line)]);
  }
  push([]);

  push([hideNames ? 'Карты учёта' : 'Реестр пациентов']);
  push([
    '№',
    ...(hideNames ? [] : ['ФИО']),
    'Пол',
    'Возраст',
    'Диагноз',
    'Код МКБ',
    'На учёте с',
    'Статус',
  ]);
  records.forEach((record, index) => {
    const patient = patientsById.get(record.patientId);
    const status =
      record.status === 'removed'
        ? `Снят${record.removedReason ? `: ${REMOVAL_REASON_LABELS[record.removedReason]}` : ''}`
        : 'Состоит';
    push([
      String(index + 1),
      // Удалённый пациент остаётся в реестре: карта на него заведена, и молча пропустить строку
      // значило бы отдать отчёт, в котором цифра итогов не сходится с числом строк.
      ...(hideNames ? [] : [patient?.fullName ?? 'Пациент удалён']),
      patient?.sex === 'male' ? 'М' : patient?.sex === 'female' ? 'Ж' : '',
      ageAt(patient?.birthDate ?? null, periodEnd),
      labelOf(record),
      codeOf(record) ?? '',
      dayjs(record.registeredDate).format('DD.MM.YYYY'),
      status,
    ]);
  });

  // Первая строка листа — заголовки, поэтому шапка отчёта уезжает в неё, а не в отдельную строку:
  // так лист открывается с осмысленной первой строкой и в просмотрщике без форматирования.
  const [header = [], ...body] = rows;
  return {
    sheetName: `Диспансеризация ${dayjs(periodStart).format('YYYY')}`,
    columns: header,
    rows: body,
  };
}
