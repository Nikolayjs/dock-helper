import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { AppShell } from '@mantine/core';

import { HEADER_HEIGHT } from './shellMetrics';
import { useScrollDirection } from '../components/layout/useScrollDirection';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet, useLocation } from 'react-router-dom';

import { ScrollToTopButton } from '../components/layout/ScrollToTopButton';
import { DemoBanner } from '../features/demo/DemoBanner';
import { SCROLL_ROOT_ID } from '../components/layout/scrollRoot';
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
  {
    match: (p) => p === '/drugs',
    title: 'Лекарственные препараты',
    subtitle: 'Справочник МНН и торговых названий, рядом — проверка взаимодействий',
  },
  { match: (p) => p === '/drugs/new', title: 'Новый препарат' },
  { match: (p) => p.startsWith('/drugs/') && p.endsWith('/edit'), title: 'Редактирование препарата' },
  { match: (p) => p.startsWith('/drugs/'), title: 'Карточка препарата' },
  {
    match: (p) => p === '/icd10',
    title: 'МКБ-10',
    subtitle: 'Международная классификация болезней: рубрики, блоки и справки по кодированию',
  },
  { match: (p) => p.startsWith('/icd10/'), title: 'Код МКБ-10' },
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
    match: (p) => p.startsWith('/reference/diseases/'),
    title: 'Заболевание',
    subtitle: 'Синонимы, код МКБ-10 и где читать подробно',
  },
  {
    match: (p) => p === '/reference',
    title: 'Справочник',
    subtitle: 'Заболевания, аббревиатуры и классификация МКБ-10',
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
    match: (p) => p === '/documents',
    title: 'Документы',
    subtitle: 'Ваши направления и реестры, а рядом — бланки для печати',
  },
  { match: (p) => p === '/documents/new', title: 'Новый документ' },
  { match: (p) => p === '/documents/templates/new', title: 'Новый бланк' },
  { match: (p) => p === '/documents/templates/scan', title: 'Бланк из снимка' },
  { match: (p) => p.startsWith('/documents/templates/') && p.endsWith('/edit'), title: 'Редактирование бланка' },
  { match: (p) => p.startsWith('/documents/') && p.endsWith('/edit'), title: 'Редактирование документа' },
  { match: (p) => p.startsWith('/documents/'), title: 'Документ' },
  // Печать бланка живёт под пациентом: /patients/:id/documents/:visitId.
  { match: (p) => p.includes('/documents/'), title: 'Документ' },
  // Ahead of the catch-all below, which otherwise titles every dispensary page "Пациент".
  {
    match: (p) => p === '/patients/dispensary/stats',
    title: 'Диспансерное наблюдение',
    subtitle: 'Отчёт по периоду и разбивка по диагнозам',
  },
  { match: (p) => p === '/patients/dispensary/new', title: 'Постановка на учёт' },
  { match: (p) => p.startsWith('/patients/dispensary/') && p.endsWith('/edit'), title: 'Редактирование карты учёта' },
  { match: (p) => p.startsWith('/patients/dispensary/'), title: 'Карта диспансерного учёта' },
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
  /*
   * Шапка прячется при прокрутке вниз и возвращается при прокрутке вверх — на длинном тексте она
   * занимает первую строку экрана и ничего не даёт. Пока открыта выдвижная панель, шапка остаётся:
   * в ней живёт бургер, которым панель закрывают, и убирать его из-под пальца нельзя.
   */
  const { visible: headerVisible } = useScrollDirection();
  /*
   * Прячется она только ниже точки перелома, и это не осторожность, а исправленная ошибка. На
   * десктопе сайдбар — элемент второго ряда сетки, прижатый к высоте шапки; уехавшая шапка
   * оставляла над ним полосу обоев, а первый пункт меню оказывался срезан. Там же, где сайдбар —
   * выдвижная панель, ничего этого нет, а выигрыш от освободившейся строки экрана наибольший.
   */
  const isMobile = useMediaQuery('(max-width: 47.99em)');
  const showHeader = !isMobile || headerVisible || opened;

  useEffect(() => {
    document.getElementById(SCROLL_ROOT_ID)?.scrollTo(0, 0);
    // Переход закрывает выдвижную панель — здесь, а не в каждой ссылке.
    //
    // Ссылки сайдбара звали `close` сами, а шапка — нет: нажатие на карточку врача уводило на
    // страницу профиля, оставляя меню открытым поверх неё. Так же вели себя логотип, результаты
    // поиска и уведомления. Место перехода знает только маршрут, поэтому закрывать правильно
    // здесь: новая ссылка в шапке не сможет об этом забыть.
    close();
  }, [location.pathname, close]);

  return (
    <AppShell
      id={SCROLL_ROOT_ID}
      /* "static" makes the header/navbar `position: sticky` inside this root element (which
       * becomes the actual scroll container) instead of `position: fixed` to the raw viewport.
       * The default "fixed" mode sized the navbar off vh/dvh/svh, which kept resizing as mobile
       * browsers' address bars hid/showed during page scroll — no CSS viewport unit tested held
       * up reliably across devices. Sticky positioning has no such dependency: its height just
       * follows the actual page layout. It also stops the address bar animation at its source —
       * mobile browsers only auto-hide it in response to the *document's own* scroll, and with
       * this root element as the sole scroll container, the document itself never scrolls. */
      mode="static"
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
      classNames={{
        root: classes.root,
        main: classes.main,
        header: showHeader ? classes.header : `${classes.header} ${classes.headerHidden}`,
        navbar: classes.navbar,
      }}
      // Липкие панели страниц прилипают к этой переменной, а не к числу: см. `STICKY_TOP`.
      style={{ '--app-sticky-top': showHeader ? `${HEADER_HEIGHT}px` : '0px' } as CSSProperties}
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
        {/* Полоса демо-режима стоит здесь, а не в шапке, намеренно: высота шапки (`HEADER_HEIGHT`)
            держит на себе каждый прилипший элемент приложения, и лишние сорок пикселей в ней
            сдвинули бы панели редакторов, рабочее место таблицы и кнопку «наверх». Внутри
            содержимого полоса видна на каждой странице — переход прокручивает страницу к началу. */}
        <DemoBanner />
        {/* Carries the bottom padding — see .content in the stylesheet for why it cannot sit on Main. */}
        <div className={classes.content}>
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
