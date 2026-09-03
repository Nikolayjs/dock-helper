import { Fragment, useMemo, useState } from 'react';

import { PageToolbar } from '../../components/common/PageToolbar';
import { ActionIcon, Avatar, Badge, Button, Card, Container, Group, Menu, Stack, Text, Title, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconClipboardHeart, IconClockExclamation, IconCopy, IconEdit, IconFileText, IconPlus, IconPrinter, IconSettings, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DispensaryCard } from './DispensaryCard';
import { PatientConstants } from './PatientConstants';
import { PageSection } from '../../components/common/PageSection';
import { PatientDocuments } from '../documents/PatientDocuments';
import { PatientLabResults } from '../labResults/PatientLabResults';
import { PatientMedications } from '../medications/PatientMedications';
import { usePatientMedications } from '../medications/usePatientMedications';
import { useLabResults } from '../labResults/useLabResults';
import { useDocumentTemplates } from './documents/useDocumentTemplates';
import { rankTemplates, readUsage } from '../dashboard/documentUsage';
import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from './referralUtils';
import type { PatientVisit } from './types';
import { QUERY_KEY as DISPENSARY_KEY, useDispensary } from './useDispensary';
import { QUERY_KEY as PATIENTS_KEY, usePatient, usePatients } from './usePatients';
import type { VisitInput } from './usePatients';
import { calcAge, formatAge, getInitials, getReminderStatus, sortedVisits } from './utils';
import { VisitForm } from './VisitForm';
import { suggestedDiagnosis } from './suggestDiagnosis';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { labResultsWarning, medicationsWarning, observationsWarning, visitsWarning } from './deleteWarnings';
import { hideVisit } from './hideNested';
import { BackButton } from '../../components/common/BackButton';

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
  const { deletePatient, addVisit, updateVisit, deleteVisit } = usePatients();
  // Запись целиком: карточка показывает тексты приёмов, а список их больше не отдаёт.
  const { patient: loadedPatient } = usePatient(id);
  const { records: dispensaryRecords, deleteRecord: deleteDispensaryRecord } = useDispensary();
  const confirmDelete = useDeleteWithConfirm();
  const { templates } = useDocumentTemplates();
  const { results: labResults } = useLabResults();
  const { medications } = usePatientMedications();
  const patient = loadedPatient;

  const [visitEditor, setVisitEditor] = useState<PatientVisit | 'new' | null>(null);
  /**
   * С чего начинается новый визит: диагноз из карты учёта или прошлого приёма — а при дублировании
   * и всё остальное, кроме даты. Врач заводит приём тому же человеку с тем же диагнозом изо дня в
   * день, и перепечатывать это заново он не должен.
   */
  const [visitSeed, setVisitSeed] = useState<PatientVisit | undefined>(undefined);

  /**
   * Бланки в меню печати — в порядке частоты, а не в том, в каком их отдал сервер.
   *
   * Счётчик печати уже копится (`documentUsage`) и до сих пор кормил только виджет дашборда, тогда
   * как выбирают бланк именно здесь: у врача их десятки, а печатает он изо дня в день три-четыре.
   * Частые идут первыми и отделены чертой, остальные — как были, чтобы список не перетасовывался
   * целиком и бланк не приходилось искать заново.
   */
  const { orderedTemplates, frequentCount } = useMemo(() => {
    const known = new Set(templates.map((template) => template.id));
    const frequent = rankTemplates(readUsage(), known).map((ranked) => ranked.id);
    const byId = new Map(templates.map((template) => [template.id, template]));
    const head = frequent.map((id) => byId.get(id)!).filter(Boolean);
    const tail = templates.filter((template) => !frequent.includes(template.id));
    return { orderedTemplates: [...head, ...tail], frequentCount: head.length };
  }, [templates]);


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
  const visits = sortedVisits(patient.visits);
  const lastVisit = visits[0];
  const patientDispensaryRecords = dispensaryRecords.filter((r) => r.patientId === patient.id);
  const ownLabResults = labResults.filter((r) => r.patientId === patient.id);
  const ownMedications = medications.filter((m) => m.patientId === patient.id);

  const handleDeletePatient = () =>
    confirmDelete({
      what: 'пациента',
      name: patient.fullName,
      alsoRemoves:
        [
          visitsWarning(patient.visits.length),
          labResultsWarning(ownLabResults.length),
          medicationsWarning(ownMedications.length),
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      notice: 'Пациент удалён',
      queryKey: PATIENTS_KEY,
      id: patient.id,
      perform: () => deletePatient(patient.id),
      onConfirmed: () => navigate('/patients'),
    });

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

  /** Новый приём: дата — сегодня, диагноз — тот, с которым человек наблюдается или приходил в прошлый раз. */
  const startNewVisit = (from?: PatientVisit) => {
    setVisitSeed(
      from
        ? { ...from, id: '', date: dayjs().format('YYYY-MM-DD'), createdAt: '' }
        : {
            id: '',
            date: dayjs().format('YYYY-MM-DD'),
            ...suggestedDiagnosis(patient, patientDispensaryRecords),
            note: '',
            referralCategory: null,
            referralDestination: '',
            createdAt: '',
          },
    );
    setVisitEditor('new');
  };

  const handleDeleteVisit = (visitId: string) => {
    const visit = patient.visits.find((item) => item.id === visitId);
    confirmDelete({
      what: 'визит',
      name: visit ? `${dayjs(visit.date).format('D MMMM YYYY')} — ${visit.diagnosis || 'без диагноза'}` : undefined,
      notice: 'Визит удалён',
      // Кэш **этой записи**: список визитов не возит, и прятать там нечего.
      queryKey: ['patients', patient.id],
      hide: hideVisit(visitId),
      perform: () => deleteVisit(patient.id, visitId),
      onConfirmed: () => {
        if (visitEditor && visitEditor !== 'new' && visitEditor.id === visitId) setVisitEditor(null);
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
              {/*
                Печать вынесена в шапку карточки, а не живёт только внутри визита.

                Раньше попасть к бланку можно было **только** через строку визита, то есть у
                пациента без визитов пути к бумаге не было вовсе. Печатается всегда последний
                приём — тот же, что подставляется в подстановки бланка; когда приёмов нет,
                кнопка ведёт к их заведению, потому что справка датируется приёмом.
              */}
              {lastVisit ? (
                <Menu position="bottom-end" withinPortal>
                  <Menu.Target>
                    <Button variant="subtle" leftSection={<IconPrinter size={16} />}>
                      Напечатать
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {orderedTemplates.length === 0 ? (
                      <Menu.Item disabled>Нет доступных бланков</Menu.Item>
                    ) : (
                      orderedTemplates.map((template, index) => (
                        <Fragment key={template.id}>
                          {index === frequentCount && frequentCount > 0 && <Menu.Divider />}
                          <Menu.Item
                            leftSection={<IconFileText size={14} />}
                            onClick={() =>
                              navigate(`/patients/${patient.id}/documents/${lastVisit.id}?templateId=${template.id}`)
                            }
                          >
                            {template.title}
                          </Menu.Item>
                        </Fragment>
                      ))
                    )}
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconSettings size={14} />} component={Link} to="/documents?tab=templates">
                      Управление шаблонами
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Button variant="subtle" leftSection={<IconPrinter size={16} />} onClick={() => startNewVisit()}>
                  Напечатать
                </Button>
              )}
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDeletePatient}>
                Удалить
              </Button>
              <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/patients/${patient.id}/edit`)}>
                Редактировать
              </Button>
            </Group>
          </Group>
        </PageToolbar>

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
            <Group gap="sm" align="center" wrap="wrap">
              {/* Аллергия стоит в шапке, а не в разделе констант ниже, и это не оформление:
                  назначая препарат, о ней надо знать не прокручивая. Полный текст — в константах. */}
              {patient.allergies && (
                <Badge variant="light" color="red" size="lg" leftSection={<IconAlertTriangle size={14} />} maw={420}>
                  Аллергия: {patient.allergies}
                </Badge>
              )}
              {reminderStatus && patient.reminderDate && (
                <Badge variant="light" color={REMINDER_COLOR[reminderStatus]} size="lg" leftSection={<IconClockExclamation size={14} />}>
                  {reminderStatus === 'overdue' ? 'Напоминание просрочено' : `Напоминание: ${dayjs(patient.reminderDate).format('D MMMM YYYY')}`}
                  {patient.reminderNote ? ` — ${patient.reminderNote}` : ''}
                </Badge>
              )}
            </Group>
          </Group>
        </Card>

        <PageSection
          title="Диспансерный учёт"
          action={
            <Button
              size="xs"
              variant="light"
              leftSection={<IconClipboardHeart size={14} />}
              onClick={() => navigate(`/patients/dispensary/new?patientId=${patient.id}`)}
            >
              Поставить на учёт
            </Button>
          }
        >
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
                onDelete={() =>
                  confirmDelete({
                    what: 'карту учёта',
                    name: patient.fullName,
                    alsoRemoves: observationsWarning(record.observations.length),
                    notice: 'Карта учёта удалена',
                    queryKey: DISPENSARY_KEY,
                    id: record.id,
                    perform: () => deleteDispensaryRecord(record.id),
                  })
                }
              />
            ))}
            </Stack>
          )}
        </PageSection>

        <PatientConstants patient={patient} />

        {/* Терапия и анализы стоят выше документов и визитов: с ними приходят на приём, и первое,
            о чём заходит разговор, — что пациент уже принимает и что изменилось с прошлого раза. */}
        <PatientMedications patientId={patient.id} />

        <PatientLabResults patientId={patient.id} />

        <PatientDocuments patientId={patient.id} />

        <PageSection
          title="История визитов"
          action={
            visitEditor === null ? (
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => startNewVisit()}>
                Добавить визит
              </Button>
            ) : null
          }
        >
          {visitEditor === 'new' && (
            <VisitForm initialVisit={visitSeed} onSubmit={handleSaveVisit} onCancel={() => setVisitEditor(null)} />
          )}

          {visits.length === 0 && visitEditor !== 'new' ? (
            <Stack align="center" gap="sm" py="lg">
              <Text fw={600}>Визитов ещё не было</Text>
              <Text size="sm" c="dimmed" ta="center">
                Добавьте первый визит — дата, диагноз и короткая заметка для памяти.
              </Text>
            </Stack>
          ) : (
          <Stack gap="sm">
            {visits.map((visit) =>
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
                          <Tooltip label="Напечатать документ">
                            <ActionIcon aria-label="Напечатать документ" variant="light" color="brand" size="md">
                              <IconPrinter size={18} />
                            </ActionIcon>
                          </Tooltip>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {templates.length === 0 ? (
                            <Menu.Item disabled>Нет доступных документов</Menu.Item>
                          ) : (
                            orderedTemplates.map((template, index) => (
                              <Fragment key={template.id}>
                                {/* Черта отделяет то, что врач печатает постоянно, от остального
                                    списка: без неё частые бланки просто стоят выше, и понять, что
                                    список отсортирован не по алфавиту, не по чему. */}
                                {index === frequentCount && frequentCount > 0 && <Menu.Divider />}
                                <Menu.Item
                                  leftSection={<IconFileText size={14} />}
                                  onClick={() =>
                                    navigate(`/patients/${patient.id}/documents/${visit.id}?templateId=${template.id}`)
                                  }
                                >
                                  {template.title}
                                </Menu.Item>
                              </Fragment>
                            ))
                          )}
                          <Menu.Divider />
                          <Menu.Item leftSection={<IconSettings size={14} />} component={Link} to="/documents?tab=templates">
                            Управление шаблонами
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                      <Tooltip label="Дублировать визит">
                        <ActionIcon aria-label="Дублировать визит" variant="subtle" color="gray" size="sm" onClick={() => startNewVisit(visit)}>
                          <IconCopy size={14} />
                        </ActionIcon>
                      </Tooltip>
                      <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={() => setVisitEditor(visit)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                      <ActionIcon aria-label="Удалить" variant="subtle" color="red" size="sm" onClick={() => handleDeleteVisit(visit.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Card>
              ),
            )}
          </Stack>
          )}
        </PageSection>
      </Stack>
    </Container>
  );
}
