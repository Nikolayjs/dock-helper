import { useMemo } from 'react';
import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconClockExclamation, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { Patient, PatientVisit } from './types';
import { calcAge, formatAge, getReminderStatus, lastVisitOf } from './utils';

/**
 * Список пациентов, по человеку на строку.
 *
 * Карточки давали каждому пациенту одинаковую крупную плитку, и практика на две сотни человек
 * прокручивалась ради фамилии, которую можно было прочитать в столбце. Строка показывает те же
 * факты — кто, когда был, с чем, — но выровненными, а только это и делает список просматриваемым.
 *
 * Диагноз показывается последний: он и опознаёт пациента в памяти врача («тот, с отитом»), а вся
 * история — в одном нажатии, в карточке.
 */

export type PatientSortKey = 'name' | 'sex' | 'age' | 'lastVisit' | 'diagnosis' | 'visits' | 'reminder';

export const PATIENT_SORT_KEYS: readonly PatientSortKey[] = [
  'name',
  'sex',
  'age',
  'lastVisit',
  'diagnosis',
  'visits',
  'reminder',
];

interface PatientTableProps {
  patients: Patient[];
  sort: SortState<PatientSortKey>;
  onSort: (key: PatientSortKey) => void;
  onOpen: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
}

const REMINDER_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

const SEX_LABEL: Record<'male' | 'female', string> = {
  male: 'М',
  female: 'Ж',
};

const DASH = '—';

function visitsLabel(count: number): string {
  if (count === 0) return DASH;
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} визитов`;
  if (last === 1) return `${count} визит`;
  if (last >= 2 && last <= 4) return `${count} визита`;
  return `${count} визитов`;
}

/**
 * По чему сортируется каждый столбец.
 *
 * Даты остаются строками ISO — `2026-05-01` упорядочивается как текст верно, а разбирать каждую
 * строку на каждое сравнение значило бы работать впустую. Возраст и число визитов — настоящие
 * числа, поэтому 2 идёт перед 10, а не после.
 */
export function patientSortValue(patient: Patient, key: PatientSortKey): SortValue {
  switch (key) {
    case 'name':
      return patient.fullName;
    case 'sex':
      return patient.sex ? SEX_LABEL[patient.sex] : null;
    case 'age':
      return calcAge(patient.birthDate);
    case 'lastVisit':
      return lastVisitOf(patient)?.date ?? null;
    case 'diagnosis':
      return lastVisitOf(patient)?.diagnosis || null;
    case 'visits':
      return patient.visits.length || null;
    case 'reminder':
      return patient.reminderDate;
  }
}

/** Строка со всем, что нужно при отрисовке: возраст и срок считаются один раз на набор. */
interface PatientRow {
  patient: Patient;
  age: number | null;
  lastVisit: PatientVisit | undefined;
  reminderStatus: 'overdue' | 'today' | 'upcoming' | null;
}

export function PatientTable({ patients, sort, onSort, onOpen, onEdit, onDelete }: PatientTableProps) {
  // Возраст и срок напоминания считаются один раз на набор, а не на каждый рендер строки: в теле
  // `.map` они пересчитывались при любом нажатии на странице, а картотека бывает на тысячи записей.
  const rows = useMemo<PatientRow[]>(
    () =>
      patients.map((patient) => ({
        patient,
        age: calcAge(patient.birthDate),
        lastVisit: lastVisitOf(patient),
        reminderStatus: patient.reminderDate ? getReminderStatus(patient.reminderDate) : null,
      })),
    [patients],
  );

  const columns: DataColumn<PatientRow, PatientSortKey>[] = [
    {
      key: 'name',
      // Ради имени список и читают; без нижней границы оно теряет ширину в пользу столбцов с
      // жёсткой шириной и обрезается до «Харина…».
      miw: 220,
      header: 'ФИО',
      render: ({ patient }) => (
        <>
          <Text fw={600} size="sm" lineClamp={1}>
            {patient.fullName}
          </Text>
          {patient.phone && (
            <Text size="xs" c="dimmed">
              {patient.phone}
            </Text>
          )}
        </>
      ),
    },
    { key: 'sex', header: 'Пол', w: 72, render: ({ patient }) => (patient.sex ? SEX_LABEL[patient.sex] : DASH) },
    { key: 'age', header: 'Возраст', w: 112, render: ({ age }) => (age !== null ? formatAge(age) : DASH) },
    {
      key: 'lastVisit',
      header: 'Последний визит',
      w: 148,
      render: ({ lastVisit }) =>
        lastVisit ? (
          dayjs(lastVisit.date).format('DD.MM.YYYY')
        ) : (
          <Text size="sm" c="dimmed">
            {DASH}
          </Text>
        ),
    },
    {
      key: 'diagnosis',
      header: 'Диагноз',
      miw: 200,
      // У пациента без визитов прочерк стоит и здесь, и в «Последнем визите», и в «Визитах»:
      // расписать это словами значило бы перенести строку на две ради нуля пользы.
      render: ({ lastVisit }) => (
        <Text size="sm" lineClamp={1} c={lastVisit ? undefined : 'dimmed'}>
          {lastVisit ? lastVisit.diagnosis || 'Без диагноза' : DASH}
        </Text>
      ),
    },
    {
      key: 'visits',
      header: 'Визитов',
      w: 124,
      render: ({ patient }) => (
        <Text size="sm" c={patient.visits.length === 0 ? 'dimmed' : undefined}>
          {visitsLabel(patient.visits.length)}
        </Text>
      ),
    },
    {
      key: 'reminder',
      header: 'Напоминание',
      w: 166,
      render: ({ patient, reminderStatus }) =>
        reminderStatus && patient.reminderDate ? (
          <Badge
            variant="light"
            color={REMINDER_COLOR[reminderStatus]}
            size="sm"
            tt="none"
            leftSection={<IconClockExclamation size={12} />}
          >
            {reminderStatus === 'overdue' ? 'Просрочено' : dayjs(patient.reminderDate).format('D MMMM')}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {DASH}
          </Text>
        ),
    },
    {
      w: 80,
      // Строка сама открывает пациента, поэтому кнопки не должны заодно открывать его же.
      stopClick: true,
      render: ({ patient }) => (
        <Group gap={2} wrap="nowrap" justify="flex-end">
          <Tooltip label="Изменить" withArrow>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(patient)}>
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить" withArrow>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(patient)}>
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
      rowKey={({ patient }) => patient.id}
      sort={sort}
      onSort={onSort}
      onRowClick={({ patient }) => onOpen(patient)}
      minWidth={980}
    />
  );
}
