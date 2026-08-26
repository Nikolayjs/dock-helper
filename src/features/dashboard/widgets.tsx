import type { ReactNode } from 'react';
import { BarChart, DonutChart } from '@mantine/charts';
import { Avatar, Badge, Button, Group, SegmentedControl, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import {
  IconBellRinging,
  IconCalendarDue,
  IconClipboardList,
  IconClockExclamation,
  IconPhoneCall,
  IconStethoscope,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { StatCard } from '../../components/common/StatCard';
import { NoteCard } from '../notes/NoteCard';
import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from '../patients/referralUtils';
import { calcAge, getInitials } from '../patients/utils';
import { AttentionQueue } from './AttentionQueue';
import { CardHeading } from './CardHeading';
import { ContinueReading } from './ContinueReading';
import { DashboardCalendar } from './DashboardCalendar';
import { DashboardNews } from './DashboardNews';
import { FavouriteCalculators } from './FavouriteCalculators';
import { FrequentDocuments } from './FrequentDocuments';
import { PatientStructure } from './PatientStructure';
import { isStructureMode, type StructureMode } from './structureMode';
import type { DashboardContext } from './dashboardContext';

/**
 * Everything the dashboard can show, as one list.
 *
 * The page renders whatever the doctor's layout names, in the order it names it — so a widget is
 * defined once here and needs no change to the page. `span` is the width on a wide screen out of
 * twelve; below `md` everything is full width, because a stat card squeezed to a quarter of a phone
 * is unreadable.
 */
export interface DashboardWidget {
  id: string;
  /** Shown in the settings panel, not on the card — the card carries its own heading. */
  title: string;
  description: string;
  span: number;
  /** The widget draws its own card (a StatCard does) and must not be wrapped in another one. */
  bare?: boolean;
  render: (ctx: DashboardContext) => ReactNode;
  /**
   * True when there is genuinely nothing to draw. Such a widget is skipped on the page and marked
   * "пусто" in the settings panel, so an empty block never takes up a screen. Counters deliberately
   * do not define this: a queue at zero is news worth reading, not an absence.
   */
  isEmpty?: (ctx: DashboardContext) => boolean;
}

const LOAD_PERIOD_LABEL: Record<string, string> = { week: 'Неделя', month: 'Месяц', year: 'Год' };

const LOAD_CAPTION: Record<string, string> = {
  week: 'Приёмы по дням за последние 7 дней',
  month: 'Приёмы по дням за последние 30 дней',
  year: 'Приёмы по месяцам за последние 12 месяцев',
};

const REFERRAL_PERIOD_LABEL: Record<string, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  halfYear: 'Полугодие',
  year: 'Год',
};

export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  // ── Рабочая очередь ───────────────────────────────────────────────────────
  {
    id: 'stat-overdue',
    title: 'Просрочен Д-контроль',
    description: 'Сколько диспансерных явок уже пропущено',
    span: 3,
    bare: true,
    render: ({ queue }) => (
      <StatCard
        label="Просрочен Д-контроль"
        value={String(queue.overdue.length)}
        icon={IconClockExclamation}
        color={queue.overdue.length > 0 ? 'red' : 'gray'}
        hint={queue.overdue.length > 0 ? 'Срок явки прошёл — вызвать на осмотр' : 'Все явки в срок'}
      />
    ),
  },
  {
    id: 'stat-soon',
    title: 'Контроль на неделе',
    description: 'Диспансерные явки в ближайшие 7 дней',
    span: 3,
    bare: true,
    render: ({ queue }) => (
      <StatCard
        label="Контроль на неделе"
        value={String(queue.soon.length)}
        icon={IconCalendarDue}
        color={queue.soon.length > 0 ? 'orange' : 'gray'}
        hint="Диспансерная явка в ближайшие 7 дней"
      />
    ),
  },
  {
    id: 'stat-visits',
    title: 'Приёмов за месяц',
    description: 'Число визитов и сравнение с прошлым месяцем',
    span: 3,
    bare: true,
    render: ({ monthlyVisits }) => (
      <StatCard
        label="Приёмов за месяц"
        value={String(monthlyVisits.current)}
        icon={IconStethoscope}
        color="brand"
        delta={monthlyVisits.deltaPercent ?? undefined}
        deltaLabel="к прошлому месяцу"
        hint={monthlyVisits.deltaPercent === null ? 'В прошлом месяце приёмов не было' : undefined}
      />
    ),
  },
  {
    id: 'stat-lapsed',
    title: 'Давно не приходили',
    description: 'Пациенты, у которых последний приём был больше года назад',
    span: 3,
    bare: true,
    render: ({ lapsed, lapsedMonths }) => (
      <StatCard
        label="Давно не приходили"
        value={String(lapsed.length)}
        icon={IconPhoneCall}
        color={lapsed.length > 0 ? 'yellow' : 'gray'}
        to="/patients"
        hint={`Последний приём больше ${lapsedMonths} месяцев назад`}
      />
    ),
  },

  // ── Работа ────────────────────────────────────────────────────────────────
  {
    id: 'attention',
    title: 'Требуют внимания',
    description: 'Поимённый список просроченных и ближайших диспансерных явок',
    span: 12,
    isEmpty: ({ queue }) => queue.overdue.length + queue.soon.length === 0,
    render: ({ queue }) => (
      <>
        <CardHeading
          title="Требуют внимания"
          caption="Диспансерный контроль: просроченные и ближайшие явки"
          action={
            <Button component={Link} to="/patients/dispensary/stats" variant="subtle" size="xs">
              Отчёт по наблюдению
            </Button>
          }
        />
        <AttentionQueue overdue={queue.overdue} soon={queue.soon} />
      </>
    ),
  },
  {
    id: 'load',
    title: 'Нагрузка на приёме',
    description: 'График визитов за неделю, месяц или год',
    span: 12,
    render: ({ visitLoad, loadPeriod, setLoadPeriod }) => {
      const total = visitLoad.reduce((sum, point) => sum + point.visits, 0);
      return (
        <>
          <CardHeading
            title="Нагрузка на приёме"
            caption={`${LOAD_CAPTION[loadPeriod]} · всего ${total}`}
            action={
              <SegmentedControl
                value={loadPeriod}
                onChange={(value) => setLoadPeriod(value as typeof loadPeriod)}
                data={Object.entries(LOAD_PERIOD_LABEL).map(([value, label]) => ({ value, label }))}
              />
            }
          />
          {total === 0 ? (
            <Text size="sm" c="dimmed">
              За этот период приёмов не записано. Визиты добавляются в карточке пациента.
            </Text>
          ) : (
            /* Одна серия — легенда не нужна, её называет заголовок карточки. */
            <BarChart
              h={260}
              data={visitLoad}
              dataKey="label"
              series={[{ name: 'visits', color: 'brand.6', label: 'Приёмы' }]}
              withLegend={false}
              gridAxis="y"
              tickLine="none"
            />
          )}
        </>
      );
    },
  },

  // ── Картина практики ──────────────────────────────────────────────────────
  {
    id: 'structure',
    title: 'Структура пациентов',
    description: 'Диагнозы, возраст, пол — по выбору или всё сразу',
    span: 6,
    render: (ctx) => {
      const stored = ctx.widgetSettings.get('structure');
      const mode: StructureMode = stored && isStructureMode(stored) ? stored : 'diagnoses';
      return (
        <>
          <CardHeading
            title="Структура пациентов"
            caption={
              mode === 'diagnoses'
                ? 'Диагнозы по числу визитов; одинаковые коды МКБ сведены вместе'
                : 'Кого вы лечите — по данным карточек пациентов'
            }
          />
          <PatientStructure
            mode={mode}
            onModeChange={(next) => ctx.widgetSettings.set('structure', next)}
            diagnoses={ctx.topDiagnoses}
            age={ctx.ageDistribution}
            sex={ctx.sexDistribution}
            undatedCount={ctx.undatedCount}
          />
        </>
      );
    },
  },
  {
    id: 'calendar',
    title: 'Календарь',
    description: 'Месяц с отметками и что запланировано на выбранный день',
    span: 6,
    render: ({ allNotes, allReminders }) => (
      <>
        <CardHeading
          title="Календарь"
          action={
            <Button component={Link} to="/calendar" variant="subtle" size="xs">
              Открыть
            </Button>
          }
        />
        <DashboardCalendar notes={allNotes} reminders={allReminders} />
      </>
    ),
  },
  {
    id: 'referrals',
    title: 'Направления',
    description: 'Куда направляли пациентов за период',
    span: 12,
    render: ({ referrals }) => (
      <>
        <CardHeading
          title="Направления"
          caption={`${dayjs(referrals.range.start).format('D MMMM YYYY')} — ${dayjs(referrals.range.end).format('D MMMM YYYY')}`}
          action={
            <SegmentedControl
              value={referrals.period}
              onChange={(v) => referrals.setPeriod(v as typeof referrals.period)}
              data={Object.entries(REFERRAL_PERIOD_LABEL).map(([value, label]) => ({ value, label }))}
            />
          }
        />
        {referrals.total === 0 ? (
          <Text size="sm" c="dimmed">
            За выбранный период направлений не было. Добавьте направление в визите пациента.
          </Text>
        ) : (
          <Group align="flex-start" wrap="wrap" gap="xl">
            <Stack gap="xs" style={{ flex: '1 1 240px', minWidth: 220 }}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Всего направлений
                </Text>
                <Badge variant="light" color="brand" size="lg">
                  {referrals.total}
                </Badge>
              </Group>
              <DonutChart data={referrals.breakdown} h={180} withLabelsLine withLabels />
              <Stack gap={6} mt="sm">
                {referrals.breakdown.map((item) => (
                  <Group key={item.name} justify="space-between">
                    <Group gap={8}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: `var(--mantine-color-${item.color.replace('.', '-')})`,
                        }}
                      />
                      <Text size="sm">{item.name}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {item.value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
            <div style={{ flex: '2 1 340px', minWidth: 300, overflowX: 'auto' }}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Пациент</Table.Th>
                    <Table.Th>Направление</Table.Th>
                    <Table.Th>Дата</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {referrals.entries.map((entry) => (
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
            </div>
          </Group>
        )}
      </>
    ),
  },

  // ── Быстрый доступ ────────────────────────────────────────────────────────
  {
    id: 'continue-reading',
    title: 'Продолжить чтение',
    description: 'Книга, которую вы читали последней, с того же места',
    span: 4,
    render: ({ reading }) => (
      <>
        <CardHeading
          title="Продолжить чтение"
          action={
            <Button component={Link} to="/library" variant="subtle" size="xs">
              Библиотека
            </Button>
          }
        />
        <ContinueReading reading={reading} />
      </>
    ),
  },
  {
    id: 'favourite-calculators',
    title: 'Избранные калькуляторы',
    description: 'Отмеченные звёздочкой — открываются в один клик',
    span: 4,
    render: () => (
      <>
        <CardHeading
          title="Избранные калькуляторы"
          action={
            <Button component={Link} to="/calculators" variant="subtle" size="xs">
              Все
            </Button>
          }
        />
        <FavouriteCalculators />
      </>
    ),
  },
  {
    id: 'news',
    title: 'Новости медицины',
    description: 'Самое свежее из подключённых лент, одним списком',
    span: 4,
    render: () => (
      <>
        <CardHeading
          title="Новости медицины"
          action={
            <Button component={Link} to="/news" variant="subtle" size="xs">
              Все новости
            </Button>
          }
        />
        <DashboardNews />
      </>
    ),
  },
  {
    id: 'frequent-documents',
    title: 'Частые документы',
    description: 'Бланки, которые вы печатаете чаще всего — сразу к выбору пациента',
    span: 4,
    render: ({ frequentTemplates, templatesById }) => (
      <>
        <CardHeading
          title="Частые документы"
          action={
            <Button component={Link} to="/patients/documents" variant="subtle" size="xs">
              Все бланки
            </Button>
          }
        />
        <FrequentDocuments ranked={frequentTemplates} templatesById={templatesById} />
      </>
    ),
  },

  // ── Дела ──────────────────────────────────────────────────────────────────
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
                  <Link to={`/patients/${patient.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
      </>
    ),
  },
];
