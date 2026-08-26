import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconClockExclamation, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { Patient } from './types';
import { calcAge, formatAge, getReminderStatus } from './utils';

/**
 * The patient list, one row each.
 *
 * Cards gave every patient the same large tile, so a practice with two hundred of them scrolled for
 * a name it could have read off a column. A row shows the same facts — who, when they were last
 * seen, what for — while keeping them aligned, which is what makes a list scannable at all.
 *
 * The diagnosis shown is the last visit's. It is the one that identifies the patient in the doctor's
 * memory («тот с отитом»), and the full history is one click away in the card.
 */

interface PatientTableProps {
  patients: Patient[];
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

function visitsLabel(count: number): string {
  if (count === 0) return '—';
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} визитов`;
  if (last === 1) return `${count} визит`;
  if (last >= 2 && last <= 4) return `${count} визита`;
  return `${count} визитов`;
}

export function PatientTable({ patients, onOpen, onEdit, onDelete }: PatientTableProps) {
  return (
    // Below this the columns crush rather than wrap, so the table scrolls sideways on a phone.
    <Table.ScrollContainer minWidth={980}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {/* The name is what the list is read for; without a floor it loses width to the
                fixed columns and truncates to «Харина…». */}
            <Table.Th miw={220}>ФИО</Table.Th>
            <Table.Th w={60}>Пол</Table.Th>
            <Table.Th w={100}>Возраст</Table.Th>
            <Table.Th w={130}>Последний визит</Table.Th>
            <Table.Th miw={200}>Диагноз</Table.Th>
            <Table.Th w={110}>Визитов</Table.Th>
            <Table.Th w={150}>Напоминание</Table.Th>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {patients.map((patient) => {
            const age = calcAge(patient.birthDate);
            const lastVisit = patient.visits[0];
            const reminderStatus = patient.reminderDate ? getReminderStatus(patient.reminderDate) : null;

            return (
              <Table.Tr
                key={patient.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpen(patient)}
              >
                <Table.Td>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {patient.fullName}
                  </Text>
                  {patient.phone && (
                    <Text size="xs" c="dimmed">
                      {patient.phone}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>{patient.sex ? SEX_LABEL[patient.sex] : '—'}</Table.Td>
                <Table.Td>{age !== null ? formatAge(age) : '—'}</Table.Td>
                <Table.Td>
                  {lastVisit ? (
                    dayjs(lastVisit.date).format('DD.MM.YYYY')
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {/* A patient with no visits shows a dash here, in «Последний визит» and in
                      «Визитов» alike; spelling it out wraps the row to two lines for no gain. */}
                  <Text size="sm" lineClamp={1} c={lastVisit ? undefined : 'dimmed'}>
                    {lastVisit ? lastVisit.diagnosis || 'Без диагноза' : '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={patient.visits.length === 0 ? 'dimmed' : undefined}>
                    {visitsLabel(patient.visits.length)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {reminderStatus && patient.reminderDate ? (
                    <Badge
                      variant="light"
                      color={REMINDER_COLOR[reminderStatus]}
                      size="sm"
                      tt="none"
                      leftSection={<IconClockExclamation size={12} />}
                    >
                      {reminderStatus === 'overdue'
                        ? 'Просрочено'
                        : dayjs(patient.reminderDate).format('D MMMM')}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                {/* The row itself opens the patient, so the buttons must not also trigger it. */}
                <Table.Td onClick={(e) => e.stopPropagation()}>
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
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
