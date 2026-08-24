import { ActionIcon, Avatar, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconClockExclamation, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { Patient } from './types';
import { calcAge, formatAge, getInitials, getReminderStatus } from './utils';

interface PatientCardProps {
  patient: Patient;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
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

export function PatientCard({ patient, onOpen, onEdit, onDelete }: PatientCardProps) {
  const age = calcAge(patient.birthDate);
  const lastVisit = patient.visits[0];
  const reminderStatus = patient.reminderDate ? getReminderStatus(patient.reminderDate) : null;

  return (
    <Card withBorder padding="md" h="100%" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar radius="md" color="brand" variant="light">
            {getInitials(patient.fullName)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" truncate>
              {patient.fullName}
            </Text>
            {(age !== null || patient.sex) && (
              <Text size="xs" c="dimmed">
                {[patient.sex ? SEX_LABEL[patient.sex] : null, age !== null ? formatAge(age) : null].filter(Boolean).join(', ')}
              </Text>
            )}
          </div>
        </Group>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {lastVisit ? (
        <Stack gap={2} mb="sm">
          <Text size="xs" c="dimmed">
            Был(а) {dayjs(lastVisit.date).format('D MMMM YYYY')}
          </Text>
          <Text size="sm" truncate>
            {lastVisit.diagnosis || 'Без диагноза'}
          </Text>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed" mb="sm">
          Визитов ещё не было
        </Text>
      )}

      <Group justify="space-between" wrap="wrap" gap={6}>
        <Badge variant="light" color="gray" size="sm">
          {patient.visits.length === 0
            ? 'Нет визитов'
            : `${patient.visits.length} ${patient.visits.length === 1 ? 'визит' : 'визита'}`}
        </Badge>
        {reminderStatus && patient.reminderDate && (
          <Badge
            variant="light"
            color={REMINDER_COLOR[reminderStatus]}
            size="sm"
            leftSection={<IconClockExclamation size={12} />}
          >
            {reminderStatus === 'overdue' ? 'Просрочено' : dayjs(patient.reminderDate).format('D MMMM')}
          </Badge>
        )}
      </Group>
    </Card>
  );
}
