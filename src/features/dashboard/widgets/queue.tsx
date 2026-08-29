import { IconCalendarDue, IconClockExclamation, IconPhoneCall, IconStethoscope } from '@tabler/icons-react';

import { StatCard } from '../../../components/common/StatCard';
import type { DashboardWidget } from './types';

/** Рабочая очередь. */
export const QUEUE_WIDGETS: DashboardWidget[] = [
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
];
