import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { SortableTh } from '../../components/common/SortableTh';
import type { SortState, SortValue } from '../../lib/tableSort';
import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import type { DispensaryRecord, Patient } from './types';
import { diagnosisCodeOf, diagnosisLabel } from './useIcd10Names';
import { getReminderStatus } from './utils';

/**
 * The dispensary register, one row per card of account.
 *
 * The columns are the ones a register is actually read for — who, with what, since when, and when
 * they are due — and the due date is the one the list is sorted by, so it earns a column rather
 * than a line of small print.
 *
 * Diagnoses imported from a spreadsheet are often a bare ICD code and nothing else, so the code is
 * resolved to a disease name the same way the statistics tables do it.
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
  patientsById: Map<string, Patient>;
  sort: SortState<DispensarySortKey>;
  onSort: (key: DispensarySortKey) => void;
  /** Resolved on the page, because sorting by diagnosis needs the same names the rows show. */
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

/**
 * What each column sorts by.
 *
 * The diagnosis sorts by the name shown, not the stored text: a register imported as bare ICD codes
 * would otherwise sort by code under a column reading disease names. Removed cards have no next
 * visit, so they sink to the bottom of that column instead of pretending one is due.
 */
export function dispensarySortValue(
  record: DispensaryRecord,
  key: DispensarySortKey,
  patientsById: Map<string, Patient>,
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

export function DispensaryTable({ records, patientsById, sort, onSort, icdNames, onOpen, onEdit, onDelete }: DispensaryTableProps) {
  return (
    <Table.ScrollContainer minWidth={1060}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {/* The name is what the register is read for; without a floor it loses width to the
                fixed columns and truncates to «Харина…». */}
            <SortableTh column="name" sort={sort} onSort={onSort} miw={220}>
              ФИО
            </SortableTh>
            <SortableTh column="diagnosis" sort={sort} onSort={onSort} miw={220}>
              Диагноз
            </SortableTh>
            <SortableTh column="code" sort={sort} onSort={onSort} w={112}>
              Код МКБ
            </SortableTh>
            <SortableTh column="registered" sort={sort} onSort={onSort} w={132}>
              На учёте с
            </SortableTh>
            <SortableTh column="nextVisit" sort={sort} onSort={onSort} w={172}>
              Следующий осмотр
            </SortableTh>
            <SortableTh column="observations" sort={sort} onSort={onSort} w={116}>
              Осмотров
            </SortableTh>
            <SortableTh column="status" sort={sort} onSort={onSort} w={170}>
              Статус
            </SortableTh>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {records.map((record) => {
            const code = diagnosisCodeOf(record.diagnosis, record.diagnosisCode);
            const nextVisitStatus =
              record.status === 'active' && record.nextVisitDate
                ? getReminderStatus(record.nextVisitDate)
                : null;

            return (
              <Table.Tr key={record.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(record)}>
                <Table.Td>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {patientsById.get(record.patientId)?.fullName ?? 'Пациент не найден'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames) || 'Без диагноза'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {code ?? (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{dayjs(record.registeredDate).format('DD.MM.YYYY')}</Table.Td>
                <Table.Td>
                  {record.status === 'removed' ? (
                    <Text size="sm" c="dimmed">
                      —
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
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={record.observations.length === 0 ? 'dimmed' : undefined}>
                    {record.observations.length === 0 ? '—' : record.observations.length}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {record.status === 'removed' ? (
                    <Badge variant="light" color="gray" size="sm" tt="none">
                      Снят
                      {record.removedReason ? `: ${REMOVAL_REASON_LABELS[record.removedReason]}` : ''}
                    </Badge>
                  ) : (
                    <Badge variant="light" color="teal" size="sm" tt="none">
                      На учёте
                    </Badge>
                  )}
                </Table.Td>
                {/* The row itself opens the card, so the buttons must not also trigger it. */}
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={2} wrap="nowrap" justify="flex-end">
                    <Tooltip label="Изменить" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(record)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Удалить" withArrow>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(record)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
