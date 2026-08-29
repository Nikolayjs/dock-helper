import { BarChart } from '../LazyCharts';
import { Button, SegmentedControl, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

import { AttentionQueue } from '../AttentionQueue';
import { CardHeading } from '../CardHeading';
import type { DashboardWidget } from './types';

const LOAD_PERIOD_LABEL: Record<string, string> = { week: 'Неделя', month: 'Месяц', year: 'Год' };

const LOAD_CAPTION: Record<string, string> = {
  week: 'Приёмы по дням за последние 7 дней',
  month: 'Приёмы по дням за последние 30 дней',
  year: 'Приёмы по месяцам за последние 12 месяцев',
};

/** Работа. */
export const WORK_WIDGETS: DashboardWidget[] = [
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
];
