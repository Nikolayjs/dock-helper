import { ActionIcon, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconCalendarEvent, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { DispensaryRecord } from './types';
import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import { getReminderStatus } from './utils';

interface DispensaryCardProps {
  record: DispensaryRecord;
  patientName: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const STATUS_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

export function DispensaryCard({ record, patientName, onOpen, onEdit, onDelete }: DispensaryCardProps) {
  const nextVisitStatus = record.status === 'active' && record.nextVisitDate ? getReminderStatus(record.nextVisitDate) : null;

  return (
    <Card withBorder padding="md" h="100%" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate>
            {patientName}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {record.diagnosisCode ? `${record.diagnosisCode} · ${record.diagnosis}` : record.diagnosis || 'Без диагноза'}
          </Text>
        </div>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Stack gap={2} mb="sm">
        <Text size="xs" c="dimmed">
          На учёте с {dayjs(record.registeredDate).format('D MMMM YYYY')}
        </Text>
      </Stack>

      <Group justify="space-between" wrap="wrap" gap={6}>
        {record.status === 'removed' ? (
          <Badge variant="light" color="gray" size="sm">
            Снят{record.removedReason ? `: ${REMOVAL_REASON_LABELS[record.removedReason]}` : ''}
            {record.removedDate ? ` · ${dayjs(record.removedDate).format('D MMMM YYYY')}` : ''}
          </Badge>
        ) : record.nextVisitDate ? (
          <Badge
            variant="light"
            color={nextVisitStatus ? STATUS_COLOR[nextVisitStatus] : 'gray'}
            size="sm"
            leftSection={<IconCalendarEvent size={12} />}
          >
            {nextVisitStatus === 'overdue' ? 'Осмотр просрочен' : `Осмотр: ${dayjs(record.nextVisitDate).format('D MMMM')}`}
          </Badge>
        ) : (
          <Badge variant="light" color="gray" size="sm">
            Дата осмотра не задана
          </Badge>
        )}
      </Group>
    </Card>
  );
}
