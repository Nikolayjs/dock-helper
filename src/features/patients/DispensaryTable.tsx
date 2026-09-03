import { useMemo } from 'react';
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import type { DispensaryRecord, PatientSummary } from './types';
import { diagnosisCodeOf, diagnosisLabel } from './useIcd10Names';
import { getReminderStatus } from './utils';

/**
 * Реестр диспансерного учёта, по карте на строку.
 *
 * Столбцы — те, ради которых реестр и читают: кто, с чем, с какого числа и когда явка. Дата явки
 * заслуживает столбца, а не строчки мелким шрифтом: именно по ней список и сортируют.
 *
 * Диагнозы, перенесённые из таблицы, часто состоят из одного кода МКБ, поэтому код разворачивается
 * в название болезни так же, как в таблицах статистики.
 */

export type DispensarySortKey =
  | 'name'
  | 'diagnosis'
  | 'code'
  | 'registered'
  | 'nextVisit'
  | 'observations'
  | 'status';

export const DISPENSARY_SORT_KEYS: readonly DispensarySortKey[] = [
  'name',
  'diagnosis',
  'code',
  'registered',
  'nextVisit',
  'observations',
  'status',
];

interface DispensaryTableProps {
  records: DispensaryRecord[];
  patientsById: Map<string, PatientSummary>;
  sort: SortState<DispensarySortKey>;
  onSort: (key: DispensarySortKey) => void;
  /** Разрешаются на странице: сортировка по диагнозу обязана использовать те же названия, что видно в строках. */
  icdNames: Record<string, string>;
  onOpen: (record: DispensaryRecord) => void;
  onEdit: (record: DispensaryRecord) => void;
  onDelete: (record: DispensaryRecord) => void;
}

const NEXT_VISIT_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

const DASH = '—';

/**
 * По чему сортируется каждый столбец.
 *
 * Диагноз сортируется по показанному названию, а не по хранимому тексту: реестр, перенесённый
 * голыми кодами МКБ, иначе упорядочивался бы по коду под столбцом с названиями болезней. У снятых
 * карт следующего осмотра нет, поэтому в этом столбце они опускаются вниз, а не притворяются, что
 * явка назначена.
 */
export function dispensarySortValue(
  record: DispensaryRecord,
  key: DispensarySortKey,
  patientsById: Map<string, PatientSummary>,
  icdNames: Record<string, string>,
): SortValue {
  switch (key) {
    case 'name':
      return patientsById.get(record.patientId)?.fullName ?? null;
    case 'diagnosis':
      return diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames) || null;
    case 'code':
      return diagnosisCodeOf(record.diagnosis, record.diagnosisCode) ?? null;
    case 'registered':
      return record.registeredDate;
    case 'nextVisit':
      return record.status === 'removed' ? null : record.nextVisitDate;
    case 'observations':
      return record.observations.length || null;
    case 'status':
      return record.status === 'removed' ? 'Снят' : 'На учёте';
  }
}

/** Строка со всем, что нужно при отрисовке: код, название и срок считаются один раз на набор. */
interface DispensaryRow {
  record: DispensaryRecord;
  name: string;
  code: string | undefined;
  label: string;
  nextVisitStatus: 'overdue' | 'today' | 'upcoming' | null;
}

export function DispensaryTable({ records, patientsById, sort, onSort, icdNames, onOpen, onEdit, onDelete }: DispensaryTableProps) {
  // Код диагноза, его название и срок следующего осмотра считаются один раз на набор: в теле `.map`
  // они пересчитывались при каждом рендере страницы, а участок — это тысячи карт.
  const rows = useMemo<DispensaryRow[]>(
    () =>
      records.map((record) => ({
        record,
        name: patientsById.get(record.patientId)?.fullName ?? 'Пациент не найден',
        code: diagnosisCodeOf(record.diagnosis, record.diagnosisCode),
        label: diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames) || 'Без диагноза',
        nextVisitStatus:
          record.status === 'active' && record.nextVisitDate ? getReminderStatus(record.nextVisitDate) : null,
      })),
    [records, patientsById, icdNames],
  );

  const columns: DataColumn<DispensaryRow, DispensarySortKey>[] = [
    {
      key: 'name',
      // На телефоне остаются имя, срок явки и кнопки: диагноз, код, дата постановки, число
      // наблюдений и статус видны в самой карте, а вместе они давали 1060 px в экране 390.
      compact: true,
      // Ради имени реестр и читают; без нижней границы оно теряет ширину в пользу столбцов с
      // жёсткой шириной и обрезается до «Харина…».
      miw: 220,
      header: 'ФИО',
      render: ({ name }) => (
        <Text fw={600} size="sm" lineClamp={1}>
          {name}
        </Text>
      ),
    },
    {
      key: 'diagnosis',
      header: 'Диагноз',
      miw: 220,
      render: ({ label }) => (
        <Text size="sm" lineClamp={1}>
          {label}
        </Text>
      ),
    },
    {
      key: 'code',
      header: 'Код МКБ',
      w: 112,
      render: ({ code }) =>
        code ?? (
          <Text size="sm" c="dimmed">
            {DASH}
          </Text>
        ),
    },
    {
      key: 'registered',
      header: 'На учёте с',
      w: 132,
      render: ({ record }) => dayjs(record.registeredDate).format('DD.MM.YYYY'),
    },
    {
      key: 'nextVisit',
      compact: true,
      header: 'Следующий осмотр',
      w: 172,
      render: ({ record, nextVisitStatus }) =>
        record.status === 'removed' ? (
          <Text size="sm" c="dimmed">
            {DASH}
          </Text>
        ) : record.nextVisitDate ? (
          <Badge variant="light" color={NEXT_VISIT_COLOR[nextVisitStatus ?? 'upcoming']} size="sm" tt="none">
            {nextVisitStatus === 'overdue'
              ? `Просрочен с ${dayjs(record.nextVisitDate).format('DD.MM.YYYY')}`
              : dayjs(record.nextVisitDate).format('DD.MM.YYYY')}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            Не назначен
          </Text>
        ),
    },
    {
      key: 'observations',
      header: 'Осмотров',
      w: 116,
      render: ({ record }) => (
        <Text size="sm" c={record.observations.length === 0 ? 'dimmed' : undefined}>
          {record.observations.length === 0 ? DASH : record.observations.length}
        </Text>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      w: 170,
      render: ({ record }) =>
        record.status === 'removed' ? (
          <Badge variant="light" color="gray" size="sm" tt="none">
            Снят
            {record.removedReason ? `: ${REMOVAL_REASON_LABELS[record.removedReason]}` : ''}
          </Badge>
        ) : (
          <Badge variant="light" color="teal" size="sm" tt="none">
            На учёте
          </Badge>
        ),
    },
    {
      w: 80,
      // Строка сама открывает карту, поэтому кнопки не должны заодно открывать её же.
      stopClick: true,
      compact: true,
      render: ({ record }) => (
        <Group gap={2} wrap="nowrap" justify="flex-end">
          <Tooltip label="Изменить" withArrow>
            <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={() => onEdit(record)}>
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить" withArrow>
            <ActionIcon aria-label="Удалить" variant="subtle" color="red" size="sm" onClick={() => onDelete(record)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={({ record }) => record.id}
      sort={sort}
      onSort={onSort}
      onRowClick={({ record }) => onOpen(record)}
      minWidth={1060}
    />
  );
}
