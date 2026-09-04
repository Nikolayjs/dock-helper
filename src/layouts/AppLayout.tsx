import { memo, useEffect } from 'react';
import { AppShell, useMantineColorScheme } from '@mantine/core';

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
import { syncThemeColorMeta } from '../lib/themeColorMeta';
import { useAppearance } from '../features/appearance/AppearanceProvider';

interface PageMetaEntry {
  match: (path: string) => boolean;
  title: string | ((path: string) => string);
  subtitle?: string;
}

const PAGE_META: PageMetaEntry[] = [
  { match: (p) => p.startsWith('/dashboard'), title: 'Дашборд', subtitle: 'Обзор рабочего дня' },
  { match: (p) => p === '/today', title: 'Мой день', subtitle: 'Кого сегодня ждём и что с ними' },
  // Конструктор — раньше общего правила: иначе он назывался бы «Интерпретатор анализов», то есть
  // тем же, что и страница разбора, и на телефоне отличить их было бы нечем.
  { match: (p) => p === '/analyzer/new', title: 'Новый анализ' },
  { match: (p) => p.startsWith('/analyzer/') && p.endsWith('/edit'), title: 'Конструктор анализа' },
  { match: (p) => p.startsWith('/analyzer'), title: 'Интерпретатор анализов', subtitle: 'ОАК, ОАМ и биохимия крови' },
  { match: (p) => p === '/diagnostics', title: 'Диагностические панели', subtitle: 'Дифференциальная диагностика по жалобе' },
  { match: (p) => p === '/diagnostics/new', title: 'Новая панель' },
  { match: (p) => p.startsWith('/diagnostics/') && p.endsWith('/edit'), title: 'Конструктор панели' },
  { match: (p) => p.startsWith('/diagnostics/'), title: 'Диагностическая панель' },
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
  {
    match: (p) => p === '/store',
    title: 'Магазин',
    subtitle: 'Анализаторы, калькуляторы, диагностические панели и бланки — поставить себе',
  },
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
  // Редактор — раньше карточки: его адрес тоже начинается с `/reference/diseases/`, и без своей
  // строки он показывал бы подзаголовок карточки.
  {
    match: (p) => p === '/reference/diseases/new' || (p.startsWith('/reference/diseases/') && p.endsWith('/edit')),
    title: 'Заболевание',
    subtitle: 'Название, коды и описание',
  },
  {
    match: (p) => p.startsWith('/reference/diseases/'),
    title: 'Заболевание',
    subtitle: 'Синонимы, код МКБ-10 и где читать подробно',
  },
  {
    match: (p) => p === '/reference',
    title: 'Справочник',
    subtitle: 'Заболевания, клинические рекомендации, аббревиатуры и МКБ-10',
  },
  {
    match: (p) => p.startsWith('/knowledge/tag/'),
    title: (p) => `Тег: ${decodeURIComponent(p.split('/').pop() ?? '')}`,
    subtitle: 'Рекомендации и статьи с этим тегом',
  },
  /* Списка по этому адресу больше нет — он переехал вкладкой в «Справочник»; осталась карточка. */
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
];

function getPageMeta(pathname: string): PageMetaEntry {
  return PAGE_META.find((entry) => entry.match(pathname)) ?? { match: () => false, title: 'MedAssist' };
}

/**
 * Содержимое страницы — за `memo`, и это условие плавности, а не микрооптимизация.
 *
 * Шапка на телефоне прячется при прокрутке вниз и возвращается при прокрутке вверх, то есть
 * `showHeader` меняется посреди жеста. Оболочка при этом перерисовывалась целиком — вместе с
 * `Outlet`, то есть со всей открытой страницей. На лёгкой странице это незаметно, на конструкторе
 * анализатора — тридцать карточек показателей и десяток правил — нет: замер на телефоне 390 px с
 * процессором, замедленным вшестеро, дал **худший кадр 1530 мс** и длинную задачу 1415 мс, тогда
 * как на странице анализов рядом — 225 и 123. Ровно это врач и назвал «фризом при появлении шапки».
 *
 * Пропсов у компонента нет вовсе, поэтому `memo` не пропускает ни одной перерисовки родителя. Смену
 * маршрута это не ломает: `Outlet` читает её из контекста роутера, а контекст сквозь `memo`
 * проходит. И лечит это **все** страницы разом, а не одну — в отличие от мемоизации каждой тяжёлой
 * страницы по очереди, которой лечилась читалка.
 */
const PageContent = memo(function PageContent() {
  return (
    <>
      {/* Полоса демо-режима стоит здесь, а не в шапке, намеренно: высота шапки (`HEADER_HEIGHT`)
          держит на себе каждый прилипший элемент приложения, и лишние сорок пикселей в ней
          сдвинули бы панели редакторов, рабочее место таблицы и кнопку «наверх». Внутри
          содержимого полоса видна на каждой странице — переход прокручивает страницу к началу. */}
      <DemoBanner />
      {/* Carries the bottom padding — see .content in the stylesheet for why it cannot sit on Main. */}
      <div className={classes.content}>
        <Outlet />
      </div>
    </>
  );
});

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

  /*
   * Полоса заголовка окна установленного приложения красится в цвет шапки — см. `themeColorMeta`.
   *
   * Считается после отрисовки, в `requestAnimationFrame`, и это не перестраховка: эффекты идут
   * снизу вверх, то есть эффект оболочки выполняется **раньше** родительского `AppearanceProvider`,
   * который и проставляет обои с подкраской. Спросив цвет сразу, мы получили бы прошлый.
   */
  const { colorScheme } = useMantineColorScheme();
  const { settings } = useAppearance();
  useEffect(() => {
    const frame = requestAnimationFrame(syncThemeColorMeta);
    return () => cancelAnimationFrame(frame);
  }, [colorScheme, settings.wallpaper, settings.tint, settings.veil]);

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
      /*
       * Состояние шапки объявляется **атрибутом**, а не сменой наследуемой переменной, и это
       * исправленная ошибка, найденная замером.
       *
       * Раньше здесь стояло `style={{ '--app-sticky-top': ... }}`. Смена наследуемого свойства на
       * предке обесценивает посчитанный стиль **всего поддерева**, а поддерево здесь — открытая
       * страница целиком. Замер на конструкторе анализатора (14 311 узлов, процессор замедлен
       * вшестеро): смена переменной — 1244 мс в медиане, переключение класса на том же элементе —
       * 0 мс. Это и был «фриз при появлении шапки», которого нет на странице анализов рядом.
       *
       * Теперь переменную переопределяет правило `[data-header-hidden] .app-sticky` в `index.css`:
       * оно достаёт только сами прилипшие панели, а их поддеревья — это десяток кнопок.
       */
      data-header-hidden={showHeader ? undefined : 'true'}
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
        <PageContent />
      </AppShell.Main>
    </AppShell>
  );
}
