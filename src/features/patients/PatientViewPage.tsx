import { useState } from 'react';
import { ActionIcon, Avatar, Badge, Button, Card, Container, Group, Menu, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconClipboardHeart,
  IconClockExclamation,
  IconEdit,
  IconFileText,
  IconPlus,
  IconPrinter,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DispensaryCard } from './DispensaryCard';
import { useDocumentTemplates } from './documents/useDocumentTemplates';
import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from './referralUtils';
import type { PatientVisit } from './types';
import { useDispensary } from './useDispensary';
import { usePatients } from './usePatients';
import type { VisitInput } from './usePatients';
import { calcAge, formatAge, getInitials, getReminderStatus } from './utils';
import { VisitForm } from './VisitForm';

const REMINDER_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

const SEX_LABEL: Record<'male' | 'female', string> = {
  male: 'Мужской',
  female: 'Женский',
};

export function PatientViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, deletePatient, addVisit, updateVisit, deleteVisit } = usePatients();
  const { records: dispensaryRecords, deleteRecord: deleteDispensaryRecord } = useDispensary();
  const { templates } = useDocumentTemplates();
  const patient = patients.find((p) => p.id === id);

  const [visitEditor, setVisitEditor] = useState<PatientVisit | 'new' | null>(null);

  if (!patient) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Пациент не найден</Text>
          <Button component={Link} to="/patients" mt="md">
            К списку пациентов
          </Button>
        </Stack>
      </Container>
    );
  }

  const age = calcAge(patient.birthDate);
  const reminderStatus = patient.reminderDate ? getReminderStatus(patient.reminderDate) : null;
  const sortedVisits = [...patient.visits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const patientDispensaryRecords = dispensaryRecords.filter((r) => r.patientId === patient.id);

  const handleDeletePatient = () => {
    deletePatient(patient.id);
    notifications.show({ message: 'Пациент удалён', color: 'gray' });
    navigate('/patients');
  };

  const handleSaveVisit = (input: VisitInput) => {
    if (visitEditor && visitEditor !== 'new') {
      updateVisit(patient.id, visitEditor.id, input);
      notifications.show({ message: 'Визит обновлён', color: 'teal' });
    } else {
      addVisit(patient.id, input);
      notifications.show({ message: 'Визит добавлен', color: 'teal' });
    }
    setVisitEditor(null);
  };

  const handleDeleteVisit = (visitId: string) => {
    deleteVisit(patient.id, visitId);
    notifications.show({ message: 'Визит удалён', color: 'gray' });
    if (visitEditor && visitEditor !== 'new' && visitEditor.id === visitId) setVisitEditor(null);
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Button component={Link} to="/patients" variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
            К списку пациентов
          </Button>
          <Group gap="xs">
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDeletePatient}>
              Удалить
            </Button>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/patients/${patient.id}/edit`)}>
              Редактировать
            </Button>
          </Group>
        </Group>

        <Card withBorder padding="lg">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="md" wrap="nowrap">
              <Avatar radius="md" color="brand" variant="light" size={56}>
                {getInitials(patient.fullName)}
              </Avatar>
              <div>
                <Title order={3}>{patient.fullName}</Title>
                <Group gap={8} mt={4}>
                  {patient.sex && (
                    <Text size="sm" c="dimmed">
                      {SEX_LABEL[patient.sex]}
                    </Text>
                  )}
                  {age !== null && (
                    <Text size="sm" c="dimmed">
                      {patient.sex ? '· ' : ''}
                      {formatAge(age)}
                    </Text>
                  )}
                  {patient.phone && (
                    <Text size="sm" c="dimmed">
                      · {patient.phone}
                    </Text>
                  )}
                </Group>
              </div>
            </Group>
            {reminderStatus && patient.reminderDate && (
              <Badge variant="light" color={REMINDER_COLOR[reminderStatus]} size="lg" leftSection={<IconClockExclamation size={14} />}>
                {reminderStatus === 'overdue' ? 'Напоминание просрочено' : `Напоминание: ${dayjs(patient.reminderDate).format('D MMMM YYYY')}`}
                {patient.reminderNote ? ` — ${patient.reminderNote}` : ''}
              </Badge>
            )}
          </Group>
        </Card>

        <Group justify="space-between">
          <Title order={4}>Диспансерный учёт</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconClipboardHeart size={14} />}
            onClick={() => navigate(`/patients/dispensary/new?patientId=${patient.id}`)}
          >
            Поставить на учёт
          </Button>
        </Group>

        {patientDispensaryRecords.length === 0 ? (
          <Text size="sm" c="dimmed">
            Пациент не состоит на диспансерном учёте.
          </Text>
        ) : (
          <Stack gap="sm">
            {patientDispensaryRecords.map((record) => (
              <DispensaryCard
                key={record.id}
                record={record}
                patientName={patient.fullName}
                onOpen={() => navigate(`/patients/dispensary/${record.id}`)}
                onEdit={() => navigate(`/patients/dispensary/${record.id}/edit`)}
                onDelete={() => {
                  deleteDispensaryRecord(record.id);
                  notifications.show({ message: 'Карта учёта удалена', color: 'gray' });
                }}
              />
            ))}
          </Stack>
        )}

        <Group justify="space-between">
          <Title order={4}>История визитов</Title>
          {visitEditor === null && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setVisitEditor('new')}>
              Добавить визит
            </Button>
          )}
        </Group>

        {visitEditor === 'new' && <VisitForm onSubmit={handleSaveVisit} onCancel={() => setVisitEditor(null)} />}

        {sortedVisits.length === 0 && visitEditor !== 'new' ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="lg">
              <Text fw={600}>Визитов ещё не было</Text>
              <Text size="sm" c="dimmed" ta="center">
                Добавьте первый визит — дата, диагноз и короткая заметка для памяти.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap="sm">
            {sortedVisits.map((visit) =>
              visitEditor !== 'new' && visitEditor?.id === visit.id ? (
                <VisitForm key={visit.id} initialVisit={visit} onSubmit={handleSaveVisit} onCancel={() => setVisitEditor(null)} />
              ) : (
                <Card key={visit.id} withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4} style={{ minWidth: 0 }}>
                      <Group gap={8}>
                        <Text fw={600} size="sm">
                          {dayjs(visit.date).format('D MMMM YYYY')}
                        </Text>
                        {visit.diagnosis && (
                          <Badge variant="light" color="brand" size="sm">
                            {visit.diagnosisCode ? `${visit.diagnosisCode} · ${visit.diagnosis}` : visit.diagnosis}
                          </Badge>
                        )}
                        {visit.referralCategory && (
                          <Badge variant="light" color={REFERRAL_CATEGORY_COLORS[visit.referralCategory]} size="sm">
                            {REFERRAL_CATEGORY_LABELS[visit.referralCategory]}
                            {visit.referralDestination ? ` · ${visit.referralDestination}` : ''}
                          </Badge>
                        )}
                      </Group>
                      {visit.note && (
                        <Text size="sm" c="dimmed">
                          {visit.note}
                        </Text>
                      )}
                    </Stack>
                    <Group gap={2} wrap="nowrap">
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm">
                            <IconPrinter size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {templates.length === 0 ? (
                            <Menu.Item disabled>Нет доступных документов</Menu.Item>
                          ) : (
                            templates.map((template) => (
                              <Menu.Item
                                key={template.id}
                                leftSection={<IconFileText size={14} />}
                                onClick={() =>
                                  navigate(`/patients/${patient.id}/documents/${visit.id}?templateId=${template.id}`)
                                }
                              >
                                {template.title}
                              </Menu.Item>
                            ))
                          )}
                          <Menu.Divider />
                          <Menu.Item leftSection={<IconSettings size={14} />} component={Link} to="/patients/documents">
                            Управление шаблонами
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setVisitEditor(visit)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteVisit(visit.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ),
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
