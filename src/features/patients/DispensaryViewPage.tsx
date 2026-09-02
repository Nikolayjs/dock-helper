import { useState } from 'react';

import { PageToolbar } from '../../components/common/PageToolbar';
import { ActionIcon, Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconEdit, IconPlus, IconTrash, IconUserCheck } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { OUTCOME_COLORS, OUTCOME_LABELS, REMOVAL_REASON_LABELS } from './dispensaryUtils';
import { ObservationForm } from './ObservationForm';
import { RemovalForm } from './RemovalForm';
import type { DispensaryObservation, DispensaryRemovalReason } from './types';
import { QUERY_KEY as DISPENSARY_KEY, useDispensary } from './useDispensary';
import type { ObservationInput } from './useDispensary';
import { usePatients } from './usePatients';
import { getReminderStatus } from './utils';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { observationsWarning } from './deleteWarnings';
import { hideObservation } from './hideNested';
import { BackButton } from '../../components/common/BackButton';

const STATUS_COLOR: Record<'overdue' | 'today' | 'upcoming', string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

export function DispensaryViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients } = usePatients();
  const { records, deleteRecord, removeFromRegistry, reinstateRecord, addObservation, updateObservation, deleteObservation } = useDispensary();
  const confirmDelete = useDeleteWithConfirm();
  const record = records.find((r) => r.id === id);

  const [observationEditor, setObservationEditor] = useState<DispensaryObservation | 'new' | null>(null);
  const [showRemovalForm, setShowRemovalForm] = useState(false);

  if (!record) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Карта не найдена</Text>
          <Button component={Link} to="/patients" mt="md">
            К списку пациентов
          </Button>
        </Stack>
      </Container>
    );
  }

  const patient = patients.find((p) => p.id === record.patientId);
  const nextVisitStatus = record.status === 'active' && record.nextVisitDate ? getReminderStatus(record.nextVisitDate) : null;
  const sortedObservations = [...record.observations].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const handleDeleteRecord = () =>
    confirmDelete({
      what: 'карту учёта',
      name: patient?.fullName,
      alsoRemoves: observationsWarning(record.observations.length),
      notice: 'Карта учёта удалена',
      queryKey: DISPENSARY_KEY,
      id: record.id,
      perform: () => deleteRecord(record.id),
      onConfirmed: () => navigate('/patients'),
    });

  const handleRemove = (date: string, reason: DispensaryRemovalReason) => {
    removeFromRegistry(record.id, date, reason);
    notifications.show({ message: 'Пациент снят с диспансерного учёта', color: 'gray' });
    setShowRemovalForm(false);
  };

  const handleReinstate = () => {
    reinstateRecord(record.id);
    notifications.show({ message: 'Пациент возвращён на учёт', color: 'teal' });
  };

  const handleSaveObservation = (input: ObservationInput) => {
    if (observationEditor && observationEditor !== 'new') {
      updateObservation(record.id, observationEditor.id, input);
      notifications.show({ message: 'Осмотр обновлён', color: 'teal' });
    } else {
      addObservation(record.id, input);
      notifications.show({ message: 'Осмотр добавлен', color: 'teal' });
    }
    setObservationEditor(null);
  };

  const handleDeleteObservation = (observationId: string) => {
    const observation = record.observations.find((item) => item.id === observationId);
    confirmDelete({
      what: 'осмотр',
      name: observation ? dayjs(observation.date).format('D MMMM YYYY') : undefined,
      notice: 'Осмотр удалён',
      queryKey: DISPENSARY_KEY,
      // An observation is not a row of the register: it has to be taken out of its card.
      hide: hideObservation(record.id, observationId),
      perform: () => deleteObservation(record.id, observationId),
      onConfirmed: () => {
        if (observationEditor && observationEditor !== 'new' && observationEditor.id === observationId) {
          setObservationEditor(null);
        }
      },
    });
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <PageToolbar>
          <Group justify="space-between" wrap="wrap">
            <BackButton fallback={{ to: '/patients', label: 'К списку пациентов' }} />
            <Group gap="xs">
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteRecord}>
                Удалить карту
              </Button>
              <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/patients/dispensary/${record.id}/edit`)}>
                Редактировать
              </Button>
            </Group>
          </Group>
        </PageToolbar>

        <Card withBorder padding="lg">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <div>
              {patient ? (
                <Link to={`/patients/${patient.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Title order={3}>{patient.fullName}</Title>
                </Link>
              ) : (
                <Title order={3}>Пациент не найден</Title>
              )}
              <Text size="sm" c="dimmed" mt={4}>
                {record.diagnosisCode ? `${record.diagnosisCode} · ${record.diagnosis}` : record.diagnosis || 'Без диагноза'}
              </Text>
              <Text size="xs" c="dimmed" mt={4}>
                На учёте с {dayjs(record.registeredDate).format('D MMMM YYYY')}
              </Text>
            </div>
            <Stack align="flex-end" gap={6}>
              {record.status === 'removed' ? (
                <Badge variant="light" color="gray" size="lg">
                  Снят{record.removedReason ? `: ${REMOVAL_REASON_LABELS[record.removedReason]}` : ''}
                  {record.removedDate ? ` · ${dayjs(record.removedDate).format('D MMMM YYYY')}` : ''}
                </Badge>
              ) : (
                record.nextVisitDate && (
                  <Badge variant="light" color={nextVisitStatus ? STATUS_COLOR[nextVisitStatus] : 'gray'} size="lg" leftSection={<IconCalendarEvent size={14} />}>
                    {nextVisitStatus === 'overdue' ? 'Осмотр просрочен' : `Ближайший осмотр: ${dayjs(record.nextVisitDate).format('D MMMM YYYY')}`}
                  </Badge>
                )
              )}
              {record.status === 'active' ? (
                <Button size="xs" variant="subtle" color="gray" onClick={() => setShowRemovalForm(true)}>
                  Снять с учёта
                </Button>
              ) : (
                <Button size="xs" variant="subtle" leftSection={<IconUserCheck size={14} />} onClick={handleReinstate}>
                  Вернуть на учёт
                </Button>
              )}
            </Stack>
          </Group>
        </Card>

        {showRemovalForm && <RemovalForm onSubmit={handleRemove} onCancel={() => setShowRemovalForm(false)} />}

        <Group justify="space-between">
          <Title order={4}>Осмотры</Title>
          {observationEditor === null && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setObservationEditor('new')}>
              Добавить осмотр
            </Button>
          )}
        </Group>

        {observationEditor === 'new' && <ObservationForm onSubmit={handleSaveObservation} onCancel={() => setObservationEditor(null)} />}

        {sortedObservations.length === 0 && observationEditor !== 'new' ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="lg">
              <Text fw={600}>Осмотров ещё не было</Text>
              <Text size="sm" c="dimmed" ta="center">
                Добавьте первый осмотр — дата, оценка эффективности и меры оздоровления.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap="sm">
            {sortedObservations.map((observation) =>
              observationEditor !== 'new' && observationEditor?.id === observation.id ? (
                <ObservationForm key={observation.id} initialObservation={observation} onSubmit={handleSaveObservation} onCancel={() => setObservationEditor(null)} />
              ) : (
                <Card key={observation.id} withBorder padding="md" radius="md">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={4} style={{ minWidth: 0 }}>
                      <Group gap={8} wrap="wrap">
                        <Text fw={600} size="sm">
                          {dayjs(observation.date).format('D MMMM YYYY')}
                        </Text>
                        <Badge variant="light" color={OUTCOME_COLORS[observation.outcome]} size="sm">
                          {OUTCOME_LABELS[observation.outcome]}
                        </Badge>
                        {observation.ovl && (
                          <Badge variant="dot" color="brand" size="sm">
                            ОВЛ
                          </Badge>
                        )}
                        {observation.sanatorium && (
                          <Badge variant="dot" color="brand" size="sm">
                            Санаторий
                          </Badge>
                        )}
                        {observation.campRest && (
                          <Badge variant="dot" color="brand" size="sm">
                            Лагерь/база отдыха
                          </Badge>
                        )}
                      </Group>
                      {observation.note && (
                        <Text size="sm" c="dimmed">
                          {observation.note}
                        </Text>
                      )}
                    </Stack>
                    <Group gap={2} wrap="nowrap">
                      <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={() => setObservationEditor(observation)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon aria-label="Удалить" variant="subtle" color="red" size="sm" onClick={() => handleDeleteObservation(observation.id)}>
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
