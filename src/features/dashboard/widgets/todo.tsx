import { Avatar, Button, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBellRinging, IconClipboardList } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { NoteCard } from '../../notes/NoteCard';
import { calcAge, getInitials, lastVisitOf } from '../../patients/utils';
import { CardHeading } from '../CardHeading';
import linkClasses from '../dashboardLinks.module.css';
import type { DashboardWidget } from './types';

/** Дела. */
export const TODO_WIDGETS: DashboardWidget[] = [
  {
    id: 'notes',
    title: 'Заметки на сегодня',
    description: 'Заметки и чек-листы, закреплённые за сегодняшней датой',
    span: 8,
    render: ({ todayNotes, notesActions }) => (
      <>
        <CardHeading
          title="Заметки на сегодня"
          action={
            <Button
              component={Link}
              to={`/notes/new?date=${dayjs().format('YYYY-MM-DD')}`}
              state={{ from: '/dashboard' }}
              variant="subtle"
              size="xs"
            >
              Добавить
            </Button>
          }
        />
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
                onOpen={() => notesActions.open(note.id)}
                onEdit={() => notesActions.edit(note.id)}
                onDelete={() => notesActions.remove(note)}
                onToggleItem={(itemId) => notesActions.toggleItem(note.id, itemId)}
              />
            ))}
          </Stack>
        )}
      </>
    ),
  },
  {
    id: 'planner',
    title: 'Задачи планера',
    description: 'Карточки планера со сроком на ближайшую неделю',
    span: 4,
    isEmpty: ({ dueCards }) => dueCards.length === 0,
    render: ({ dueCards }) => (
      <>
        <CardHeading
          title="Задачи планера"
          action={
            <Button component={Link} to="/planner" variant="subtle" size="xs">
              Открыть
            </Button>
          }
        />
        {dueCards.length === 0 ? (
          <Text size="sm" c="dimmed">
            Нет задач со сроком на ближайшую неделю. Поставьте карточке в планере дату — она появится здесь.
          </Text>
        ) : (
          <Stack gap="sm">
            {dueCards.slice(0, 6).map((card) => {
              const overdue = dayjs(card.dueDate).isBefore(dayjs(), 'day');
              return (
                <Group key={card.id} gap={8} wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color={overdue ? 'red' : 'brand'} size={28} radius="md">
                    <IconClipboardList size={14} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={500} truncate>
                      {card.title}
                    </Text>
                    <Text size="xs" c={overdue ? 'red' : 'dimmed'}>
                      {dayjs(card.dueDate).format('D MMMM')}
                      {overdue ? ' · просрочено' : ''}
                    </Text>
                  </div>
                </Group>
              );
            })}
          </Stack>
        )}
      </>
    ),
  },
  {
    id: 'patient-reminders',
    title: 'Напоминания о визитах',
    description: 'Напоминания, проставленные в карточках пациентов',
    span: 4,
    isEmpty: ({ patientReminders }) => patientReminders.length === 0,
    render: ({ patientReminders }) => (
      <>
        <CardHeading title="Напоминания о визитах" />
        {patientReminders.length === 0 ? (
          <Text size="sm" c="dimmed">
            Ни у кого не проставлена дата следующего визита. Она задаётся в карточке пациента.
          </Text>
        ) : (
          <Stack gap="sm">
            {patientReminders.map(({ patient, status }) => (
              <Group key={patient.id} gap={8} wrap="nowrap" align="flex-start">
                <ThemeIcon
                  variant="light"
                  color={status === 'overdue' ? 'red' : status === 'today' ? 'orange' : 'teal'}
                  size={28}
                  radius="md"
                >
                  <IconBellRinging size={14} />
                </ThemeIcon>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    to={`/patients/${patient.id}`}
                    state={{ from: '/dashboard' }}
                    className={linkClasses.row}
                  >
                    <Text size="sm" fw={500} truncate>
                      {patient.fullName}
                    </Text>
                  </Link>
                  <Text size="xs" c="dimmed">
                    {dayjs(patient.reminderDate).format('D MMMM')}
                    {patient.reminderNote ? ` · ${patient.reminderNote}` : ''}
                  </Text>
                </div>
              </Group>
            ))}
          </Stack>
        )}
      </>
    ),
  },
  {
    id: 'calendar-reminders',
    title: 'Напоминания на неделю',
    description: 'Напоминания из календаря на ближайшие 7 дней',
    span: 4,
    isEmpty: ({ calendarReminders }) => calendarReminders.length === 0,
    render: ({ calendarReminders }) => (
      <>
        <CardHeading
          title="Напоминания на неделю"
          action={
            <Button component={Link} to="/calendar" variant="subtle" size="xs">
              Добавить
            </Button>
          }
        />
        {calendarReminders.length === 0 ? (
          <Text size="sm" c="dimmed">
            На ближайшую неделю напоминаний нет.
          </Text>
        ) : (
          <Stack gap="sm">
            {calendarReminders.map((reminder) => (
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
      </>
    ),
  },
  {
    id: 'recent-patients',
    title: 'Последние пациенты',
    description: 'Кто был на приёме недавно',
    span: 4,
    isEmpty: ({ recentPatients }) => recentPatients.length === 0,
    render: ({ recentPatients }) => (
      <>
        <CardHeading title="Последние пациенты" />
        <Stack gap="md">
          {recentPatients.map((patient) => {
            const age = calcAge(patient.birthDate);
            const lastVisit = lastVisitOf(patient);
            return (
              <Link
                key={patient.id}
                to={`/patients/${patient.id}`}
                state={{ from: '/dashboard' }}
                className={linkClasses.row}
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
                        {lastVisit?.diagnosis || 'Без диагноза'}
                      </Text>
                    </div>
                  </Group>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {lastVisit ? dayjs(lastVisit.date).format('D MMM') : ''}
                  </Text>
                </Group>
              </Link>
            );
          })}
        </Stack>
      </>
    ),
  },
];
