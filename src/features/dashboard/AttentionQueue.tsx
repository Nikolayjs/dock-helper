import { Badge, Group, Stack, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { calcAge, formatAge } from '../patients/utils';
import type { DispensaryDue } from './practice';

/**
 * The follow-up queue, by name.
 *
 * The point of putting the list here rather than behind the count is that the count alone still
 * leaves the doctor a search to do. Here the seven overdue people are seven rows, each a link
 * straight into the registry card where the observation gets recorded.
 */

/**
 * Kept short on purpose: the badge sits next to the actual date, so it only has to say how far off
 * that date is. Spelled out in full ("59 дней назад") it overflows the badge and gets clipped.
 */
function lateLabel(daysLate: number): string {
  if (daysLate === 0) return 'Сегодня';
  if (daysLate < 0) return `через ${-daysLate} дн.`;
  if (daysLate >= 60) return `${Math.floor(daysLate / 30)} мес. назад`;
  if (daysLate === 1) return 'вчера';
  return `${daysLate} дн. назад`;
}

interface AttentionQueueProps {
  overdue: DispensaryDue[];
  soon: DispensaryDue[];
  limit?: number;
}

export function AttentionQueue({ overdue, soon, limit = 10 }: AttentionQueueProps) {
  // Overdue first: the ones already missed are the ones that stop being recoverable.
  const rows = [...overdue, ...soon];
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;

  return (
    <Stack gap="sm">
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Пациент</Table.Th>
            <Table.Th>Диагноз</Table.Th>
            <Table.Th>Контроль</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shown.map((due) => {
            const age = due.patient ? calcAge(due.patient.birthDate) : null;
            return (
              <Table.Tr key={due.record.id}>
                <Table.Td>
                  <Link
                    to={`/patients/dispensary/${due.record.id}`}
                    state={{ from: '/dashboard' }}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <Text size="sm" fw={500}>
                      {due.patient?.fullName ?? 'Пациент удалён'}
                    </Text>
                    {age !== null && (
                      <Text size="xs" c="dimmed">
                        {formatAge(age)}
                      </Text>
                    )}
                  </Link>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>
                    {due.record.diagnosis}
                    {due.record.diagnosisCode && (
                      <Text span size="xs" c="dimmed">
                        {' '}
                        · {due.record.diagnosisCode}
                      </Text>
                    )}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={8} wrap="nowrap">
                    {/* Не сжимается: иначе соседняя дата съедает подпись и та обрезается многоточием. */}
                    <Badge variant="light" color={due.daysLate > 0 ? 'red' : 'orange'} size="sm" style={{ flexShrink: 0 }}>
                      {lateLabel(due.daysLate)}
                    </Badge>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {dayjs(due.dueDate).format('D MMM')}
                    </Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      {hidden > 0 && (
        <Text size="xs" c="dimmed">
          И ещё {hidden} — полный список в разделе «Пациенты», вкладка «Диспансерное наблюдение».
        </Text>
      )}
    </Stack>
  );
}
