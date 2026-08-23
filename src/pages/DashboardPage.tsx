import { useMemo, useState } from 'react';
import { AreaChart, DonutChart } from '@mantine/charts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Container,
  Grid,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBellRinging,
  IconCalendarStats,
  IconChecklist,
  IconClockExclamation,
  IconUsers,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';

import { StatCard } from '../components/common/StatCard';
import {
  getReferralBreakdown,
  getReferralEntries,
  getReferralPeriodRange,
  getRecentPatients,
  getReminderStatusBreakdown,
  getTodayChecklist,
  getTodayNotes,
  getUpcomingReminders,
  getWeeklyVisitFlow,
} from '../features/dashboard/selectors';
import type { ReferralPeriod } from '../features/dashboard/selectors';
import { NoteCard } from '../features/notes/NoteCard';
import { useNotes } from '../features/notes/useNotes';
import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from '../features/patients/referralUtils';
import { calcAge, formatAge, getInitials } from '../features/patients/utils';
import { usePatients } from '../features/patients/usePatients';
import type { ReminderStatus } from '../features/patients/utils';
import { getUpcomingReminders as getUpcomingCalendarReminders } from '../features/reminders/selectors';
import { useReminders } from '../features/reminders/useReminders';

const REFERRAL_PERIOD_LABEL: Record<ReferralPeriod, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  halfYear: 'Полугодие',
  year: 'Год',
};

const REMINDER_COLOR: Record<ReminderStatus, string> = {
  overdue: 'red',
  today: 'orange',
  upcoming: 'teal',
};

const REMINDER_LABEL: Record<'overdue' | 'today', string> = {
  overdue: 'Просрочено',
  today: 'Сегодня',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { patients } = usePatients();
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const { reminders } = useReminders();
  const [referralPeriod, setReferralPeriod] = useState<ReferralPeriod>('month');

  const checklist = getTodayChecklist(notes);
  const todayNotes = getTodayNotes(notes);
  const recentPatients = getRecentPatients(patients, 4);
  const upcomingReminders = getUpcomingReminders(patients, 6);
  const upcomingCalendarReminders = getUpcomingCalendarReminders(reminders, 7);
  const weeklyVisitFlow = getWeeklyVisitFlow(patients);
  const reminderBreakdown = getReminderStatusBreakdown(patients);

  const referralRange = useMemo(() => getReferralPeriodRange(referralPeriod), [referralPeriod]);
  const referralBreakdown = useMemo(
    () => getReferralBreakdown(patients, referralRange.start, referralRange.end),
    [patients, referralRange],
  );
  const referralEntries = useMemo(
    () => getReferralEntries(patients, referralRange.start, referralRange.end, 8),
    [patients, referralRange],
  );
  const totalReferrals = referralBreakdown.reduce((sum, item) => sum + item.value, 0);

  const todayCount = upcomingReminders.filter((r) => r.status === 'today').length;
  const overdueCount = upcomingReminders.filter((r) => r.status === 'overdue').length;
  const doneToday = checklist.filter((item) => item.done).length;

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          <StatCard label="Пациентов в базе" value={String(patients.length)} icon={IconUsers} color="brand" />
          <StatCard label="Напоминаний сегодня" value={String(todayCount)} icon={IconCalendarStats} color="grape" />
          <StatCard label="Просрочено напоминаний" value={String(overdueCount)} icon={IconClockExclamation} color="red" />
          <StatCard label="Задач на сегодня" value={`${doneToday}/${checklist.length}`} icon={IconChecklist} color="mint" />
        </SimpleGrid>

        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md" wrap="wrap">
            <div>
              <Title order={4}>Направления</Title>
              <Text size="sm" c="dimmed">
                {dayjs(referralRange.start).format('D MMMM YYYY')} — {dayjs(referralRange.end).format('D MMMM YYYY')}
              </Text>
            </div>
            <SegmentedControl
              value={referralPeriod}
              onChange={(v) => setReferralPeriod(v as ReferralPeriod)}
              data={(Object.keys(REFERRAL_PERIOD_LABEL) as ReferralPeriod[]).map((value) => ({ value, label: REFERRAL_PERIOD_LABEL[value] }))}
            />
          </Group>

          {totalReferrals === 0 ? (
            <Text size="sm" c="dimmed">
              За выбранный период направлений не было. Добавьте направление в визите пациента.
            </Text>
          ) : (
            <Grid gap="lg">
              <Grid.Col span={{ base: 12, sm: 5 }}>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="dimmed">
                    Всего направлений
                  </Text>
                  <Badge variant="light" color="brand" size="lg">
                    {totalReferrals}
                  </Badge>
                </Group>
                <DonutChart data={referralBreakdown} h={180} withLabelsLine withLabels />
                <Stack gap={6} mt="md">
                  {referralBreakdown.map((item) => (
                    <Group key={item.name} justify="space-between">
                      <Group gap={8}>
                        <div style={{ width: 8, height: 8, borderRadius: 999, background: `var(--mantine-color-${item.color.replace('.', '-')})` }} />
                        <Text size="sm">{item.name}</Text>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {item.value}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 7 }}>
                <Table verticalSpacing="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Пациент</Table.Th>
                      <Table.Th>Направление</Table.Th>
                      <Table.Th>Дата</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {referralEntries.map((entry) => (
                      <Table.Tr key={entry.visitId}>
                        <Table.Td>
                          <Link to={`/patients/${entry.patientId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Text size="sm" fw={500}>
                              {entry.patientName}
                            </Text>
                          </Link>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color={REFERRAL_CATEGORY_COLORS[entry.category]} size="sm">
                            {REFERRAL_CATEGORY_LABELS[entry.category]}
                            {entry.destination ? ` · ${entry.destination}` : ''}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{dayjs(entry.date).format('D MMMM')}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Grid.Col>
            </Grid>
          )}
        </Card>

        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={4}>Поток пациентов</Title>
                    <Text size="sm" c="dimmed">
                      Визиты за последние 7 дней
                    </Text>
                  </div>
                </Group>
                <AreaChart
                  h={260}
                  data={weeklyVisitFlow}
                  dataKey="day"
                  withGradient
                  curveType="monotone"
                  series={[{ name: 'visits', color: 'brand.6', label: 'Визиты' }]}
                  withLegend={false}
                  gridAxis="xy"
                  tickLine="none"
                />
              </Card>

              <Card withBorder padding="lg">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Ближайшие напоминания</Title>
                  <Badge variant="light" color="brand">
                    {upcomingReminders.length}
                  </Badge>
                </Group>
                {upcomingReminders.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Нет активных напоминаний о визитах. Добавьте напоминание в карточке пациента.
                  </Text>
                ) : (
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Пациент</Table.Th>
                        <Table.Th>Комментарий</Table.Th>
                        <Table.Th>Дата</Table.Th>
                        <Table.Th>Статус</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {upcomingReminders.map(({ patient, status }) => {
                        const age = calcAge(patient.birthDate);
                        return (
                          <Table.Tr key={patient.id}>
                            <Table.Td>
                              <Link to={`/patients/${patient.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <Group gap={8} wrap="nowrap">
                                  <Avatar size={28} radius="xl" color="brand">
                                    {getInitials(patient.fullName)}
                                  </Avatar>
                                  <div>
                                    <Text size="sm" fw={500}>
                                      {patient.fullName}
                                    </Text>
                                    {age !== null && (
                                      <Text size="xs" c="dimmed">
                                        {formatAge(age)}
                                      </Text>
                                    )}
                                  </div>
                                </Group>
                              </Link>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c={patient.reminderNote ? undefined : 'dimmed'}>
                                {patient.reminderNote || 'Без комментария'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{dayjs(patient.reminderDate).format('D MMMM')}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color={REMINDER_COLOR[status]} size="sm">
                                {status === 'upcoming' ? dayjs(patient.reminderDate).format('D MMMM') : REMINDER_LABEL[status]}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Card withBorder padding="lg">
                <Title order={4} mb="md">
                  Статус напоминаний
                </Title>
                {reminderBreakdown.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Пока нет напоминаний о визитах.
                  </Text>
                ) : (
                  <>
                    <DonutChart data={reminderBreakdown} h={200} withLabelsLine withLabels />
                    <Stack gap={6} mt="md">
                      {reminderBreakdown.map((item) => (
                        <Group key={item.name} justify="space-between">
                          <Group gap={8}>
                            <div style={{ width: 8, height: 8, borderRadius: 999, background: `var(--mantine-color-${item.color.replace('.', '-')})` }} />
                            <Text size="sm">{item.name}</Text>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {item.value}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </>
                )}
              </Card>

              <Card withBorder padding="lg">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Напоминания на неделю</Title>
                  <Button component={Link} to="/calendar" variant="subtle" size="xs">
                    Добавить
                  </Button>
                </Group>
                {upcomingCalendarReminders.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    На ближайшую неделю напоминаний нет. Добавьте напоминание на вкладке «Напоминания» в календаре.
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {upcomingCalendarReminders.map((reminder) => (
                      <Group key={reminder.id} gap={8} wrap="nowrap" align="flex-start">
                        <ThemeIcon variant="light" color="orange" size={28} radius="md">
                          <IconBellRinging size={14} />
                        </ThemeIcon>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Text size="sm" fw={500} truncate>
                            {reminder.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {dayjs(reminder.datetime).format('D MMMM, HH:mm')}
                          </Text>
                        </div>
                      </Group>
                    ))}
                  </Stack>
                )}
              </Card>

              <Card withBorder padding="lg">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Заметки на сегодня</Title>
                  <Button
                    component={Link}
                    to={`/notes/new?date=${dayjs().format('YYYY-MM-DD')}`}
                    state={{ from: '/dashboard' }}
                    variant="subtle"
                    size="xs"
                  >
                    Добавить
                  </Button>
                </Group>
                {todayNotes.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    На сегодня нет закреплённых заметок. Создайте заметку или чек-лист и закрепите её за сегодняшней датой.
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {todayNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        onOpen={() => navigate(`/notes/${note.id}`, { state: { from: '/dashboard' } })}
                        onEdit={() => navigate(`/notes/${note.id}/edit`, { state: { from: '/dashboard' } })}
                        onDelete={() => {
                          deleteNote(note.id);
                          notifications.show({ message: 'Заметка удалена', color: 'gray' });
                        }}
                        onToggleItem={(itemId) => toggleTodoItem(note.id, itemId)}
                      />
                    ))}
                  </Stack>
                )}
              </Card>

              <Card withBorder padding="lg">
                <Title order={4} mb="md">
                  Последние пациенты
                </Title>
                {recentPatients.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Пока нет пациентов с визитами.
                  </Text>
                ) : (
                  <Stack gap="md">
                    {recentPatients.map((patient) => {
                      const age = calcAge(patient.birthDate);
                      const lastVisit = patient.visits[0];
                      return (
                        <Link
                          key={patient.id}
                          to={`/patients/${patient.id}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <Group gap={8} wrap="nowrap">
                              <Avatar size={32} radius="xl" color="brand">
                                {getInitials(patient.fullName)}
                              </Avatar>
                              <div style={{ overflow: 'hidden' }}>
                                <Text size="sm" fw={500} truncate>
                                  {patient.fullName}
                                  {age !== null ? `, ${age}` : ''}
                                </Text>
                                <Text size="xs" c="dimmed" truncate>
                                  {lastVisit.diagnosis || 'Без диагноза'}
                                </Text>
                              </div>
                            </Group>
                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                              {dayjs(lastVisit.date).format('D MMM')}
                            </Text>
                          </Group>
                        </Link>
                      );
                    })}
                  </Stack>
                )}
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
