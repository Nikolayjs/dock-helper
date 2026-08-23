import { useEffect } from 'react';
import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useLocation } from 'react-router-dom';

import { ScrollToTopButton } from '../components/layout/ScrollToTopButton';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { useSidebarWidth } from '../components/layout/useSidebarWidth';
import { ReminderWatcher } from '../features/reminders/ReminderWatcher';
import classes from './AppLayout.module.css';

interface PageMetaEntry {
  match: (path: string) => boolean;
  title: string | ((path: string) => string);
  subtitle?: string;
}

const PAGE_META: PageMetaEntry[] = [
  { match: (p) => p.startsWith('/dashboard'), title: 'Дашборд', subtitle: 'Обзор рабочего дня' },
  { match: (p) => p.startsWith('/analyzer'), title: 'Интерпретатор анализов', subtitle: 'ОАК, ОАМ и биохимия крови' },
  { match: (p) => p === '/interactions', title: 'Проверка взаимодействий', subtitle: 'Ограниченный набор известных лекарственных взаимодействий' },
  { match: (p) => p === '/planner', title: 'Планер', subtitle: 'Доска задач с колонками и карточками' },
  { match: (p) => p.startsWith('/doctor'), title: 'Мой профиль', subtitle: 'Данные врача, настройки и статистика' },
  {
    match: (p) => p === '/calculators',
    title: 'Калькуляторы',
    subtitle: 'Медицинские шкалы и формулы',
  },
  {
    match: (p) => p === '/calculators/new',
    title: 'Новый калькулятор',
    subtitle: 'Соберите свою формулу за пару минут',
  },
  {
    match: (p) => p.startsWith('/calculators/') && p.endsWith('/edit'),
    title: 'Редактирование калькулятора',
  },
  { match: (p) => p.startsWith('/calculators/'), title: 'Калькулятор' },
  { match: (p) => p === '/notes', title: 'Заметки', subtitle: 'Заметки и чек-листы' },
  { match: (p) => p === '/notes/new', title: 'Новая заметка' },
  { match: (p) => p.startsWith('/notes/') && p.endsWith('/edit'), title: 'Редактирование заметки' },
  { match: (p) => p.startsWith('/notes/'), title: 'Заметка' },
  { match: (p) => p === '/calendar', title: 'Календарь', subtitle: 'Заметки и напоминания по датам' },
  {
    match: (p) => p === '/news',
    title: 'Новости медицины',
    subtitle: 'Заголовки из RSS-лент — с переходом к первоисточнику',
  },
  { match: (p) => p === '/news/read', title: 'Статья' },
  {
    match: (p) => p === '/knowledge/graph',
    title: 'Граф знаний',
    subtitle: 'Связи между рекомендациями и статьями',
  },
  {
    match: (p) => p.startsWith('/knowledge/tag/'),
    title: (p) => `Тег: ${decodeURIComponent(p.split('/').pop() ?? '')}`,
    subtitle: 'Рекомендации и статьи с этим тегом',
  },
  {
    match: (p) => p === '/guidelines',
    title: 'Клинические рекомендации',
    subtitle: 'Протоколы и рекомендации',
  },
  { match: (p) => p === '/guidelines/new', title: 'Новая рекомендация' },
  { match: (p) => p.startsWith('/guidelines/') && p.endsWith('/edit'), title: 'Редактирование рекомендации' },
  { match: (p) => p.startsWith('/guidelines/'), title: 'Рекомендация' },
  {
    match: (p) => p === '/articles',
    title: 'Статьи',
    subtitle: 'Клинические случаи, обзоры, заметки',
  },
  { match: (p) => p === '/articles/new', title: 'Новая статья' },
  { match: (p) => p.startsWith('/articles/') && p.endsWith('/edit'), title: 'Редактирование статьи' },
  { match: (p) => p.startsWith('/articles/'), title: 'Статья' },
  {
    match: (p) => p === '/library',
    title: 'Библиотека',
    subtitle: 'Ваши книги в формате PDF и FB2',
  },
  { match: (p) => p.startsWith('/library/') && p.endsWith('/read'), title: 'Читалка' },
  { match: (p) => p.startsWith('/library/'), title: 'Книга' },
  { match: (p) => p === '/patients', title: 'Пациенты', subtitle: 'Личные заметки — не медицинская карта' },
  { match: (p) => p === '/patients/new', title: 'Новый пациент' },
  {
    match: (p) => p === '/patients/documents',
    title: 'Документы',
    subtitle: 'Шаблоны справок, направлений и других печатных документов',
  },
  { match: (p) => p === '/patients/documents/new', title: 'Новый документ' },
  { match: (p) => p.startsWith('/patients/documents/') && p.endsWith('/edit'), title: 'Редактирование документа' },
  { match: (p) => p.includes('/documents/'), title: 'Документ' },
  { match: (p) => p.startsWith('/patients/') && p.endsWith('/edit'), title: 'Редактирование пациента' },
  { match: (p) => p.startsWith('/patients/'), title: 'Пациент' },
  { match: (p) => p.startsWith('/schedule'), title: 'Расписание' },
  { match: (p) => p.startsWith('/messages'), title: 'Сообщения' },
];

function getPageMeta(pathname: string): PageMetaEntry {
  return PAGE_META.find((entry) => entry.match(pathname)) ?? { match: () => false, title: 'MedAssist' };
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const location = useLocation();
  const meta = getPageMeta(location.pathname);
  const title = typeof meta.title === 'function' ? meta.title(location.pathname) : meta.title;
  const { width, collapsed, startResize, toggleCollapsed } = useSidebarWidth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <AppShell
      header={{ height: 68 }}
      navbar={{ width, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
      classNames={{ main: classes.main, header: classes.header, navbar: classes.navbar }}
    >
      <ReminderWatcher />
      <ScrollToTopButton />

      <AppShell.Header>
        <Topbar title={title} subtitle={meta.subtitle} onBurgerClick={toggle} />
      </AppShell.Header>

      <AppShell.Navbar>
        <Sidebar onNavigate={close} collapsed={collapsed} onStartResize={startResize} onToggleCollapsed={toggleCollapsed} />
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
