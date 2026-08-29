import { Button, Group } from '@mantine/core';
import { Link } from 'react-router-dom';

import { CardHeading } from '../CardHeading';
import { CONTINUE_READING_ID, ContinueReading, SHELF_DEFAULT } from '../ContinueReading';
import { DashboardNews } from '../DashboardNews';
import { FAVOURITE_CALCULATORS_ID, FavouriteCalculators } from '../FavouriteCalculators';
import { FrequentDocuments } from '../FrequentDocuments';
import { RowLimitSelect } from '../RowLimitSelect';
import type { DashboardWidget } from './types';

/** Быстрый доступ. */
export const QUICK_ACCESS_WIDGETS: DashboardWidget[] = [
  {
    id: 'continue-reading',
    title: 'Продолжить чтение',
    description: 'Последняя книга с того же места, под ней — остальные начатые',
    span: 4,
    render: ({ readingShelf, widgetSettings }) => (
      <>
        <CardHeading
          title="Продолжить чтение"
          action={
            <Group gap={4} wrap="nowrap">
              {/* Число касается только строк под закреплённой книгой: сама она показывается всегда. */}
              {readingShelf.length > 1 && (
                <RowLimitSelect
                  value={widgetSettings.get(CONTINUE_READING_ID)}
                  onChange={(value) => widgetSettings.set(CONTINUE_READING_ID, value)}
                  fallback={SHELF_DEFAULT}
                />
              )}
              <Button component={Link} to="/library" variant="subtle" size="xs">
                Библиотека
              </Button>
            </Group>
          }
        />
        <ContinueReading shelf={readingShelf} settings={widgetSettings} />
      </>
    ),
  },
  {
    id: 'favourite-calculators',
    title: 'Избранные калькуляторы',
    description: 'Отмеченные звёздочкой — открываются в один клик, порядок задаётся перетаскиванием',
    span: 4,
    render: ({ widgetSettings }) => (
      <>
        <CardHeading
          title="Избранные калькуляторы"
          action={
            <Group gap={4} wrap="nowrap">
              {/* Сколько строк видно сразу. Стоит у самой карточки, а не в панели настройки
                  дашборда: число меняют, глядя на неё, и результат виден в тот же миг. */}
              <RowLimitSelect
                value={widgetSettings.get(FAVOURITE_CALCULATORS_ID)}
                onChange={(value) => widgetSettings.set(FAVOURITE_CALCULATORS_ID, value)}
              />
              <Button component={Link} to="/calculators" variant="subtle" size="xs">
                Все
              </Button>
            </Group>
          }
        />
        <FavouriteCalculators settings={widgetSettings} />
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
            <Button component={Link} to="/documents?tab=templates" variant="subtle" size="xs">
              Все бланки
            </Button>
          }
        />
        <FrequentDocuments ranked={frequentTemplates} templatesById={templatesById} />
      </>
    ),
  },
];
