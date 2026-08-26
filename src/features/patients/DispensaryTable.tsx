import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import type { DispensaryRecord, Patient } from './types';
import { diagnosisCodeOf, diagnosisLabel, useIcd10Names } from './useIcd10Names';
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

interface DispensaryTableProps {
  records: DispensaryRecord[];
  patientsById: Map<string, Patient>;
  onOpen: (record: DispensaryRecord) => void;
  onEdit: (record: DispensaryRecord) => void;
  onDelete: (record: DispensaryRecord) => void;
}

const NEXT_VISIT_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

export function DispensaryTable({ records, patientsById, onOpen, onEdit, onDelete }: DispensaryTableProps) {
  const icdNames = useIcd10Names(
    records.map((record) => diagnosisCodeOf(record.diagnosis, record.diagnosisCode) ?? ''),
  );

  return (
    <Table.ScrollContainer minWidth={1060}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {/* The name is what the register is read for; without a floor it loses width to the
                fixed columns and truncates to «Харина…». */}
            <Table.Th miw={220}>ФИО</Table.Th>
            <Table.Th miw={220}>Диагноз</Table.Th>
            <Table.Th w={100}>Код МКБ</Table.Th>
            <Table.Th w={120}>На учёте с</Table.Th>
            <Table.Th w={160}>Следующий осмотр</Table.Th>
            <Table.Th w={100}>Осмотров</Table.Th>
            <Table.Th w={170}>Статус</Table.Th>
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
