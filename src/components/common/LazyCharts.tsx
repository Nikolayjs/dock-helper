import { Suspense, lazy, type ComponentProps } from 'react';
import { Skeleton } from '@mantine/core';

/**
 * Диаграммы, подключаемые в момент показа.
 *
 * `@mantine/charts` тянет за собой recharts — это 134 КБ gzip, треть всего, что скачивает дашборд.
 * Карточек с диаграммами на нём три из полутора десятков, и врач волен ни одной не включить;
 * статический импорт заставлял платить за них всех. Та же причина у динамики показателя в карточке
 * пациента: график там появляется, только когда сохранённых анализов больше одного.
 *
 * Заглушка занимает **ту же высоту**, что и будущая диаграмма: карточки дашборда меряются
 * `ResizeObserver`, и появление диаграммы из ниоткуда перекладывало бы сетку у врача на глазах.
 */
const LazyBarChart = lazy(() => import('@mantine/charts').then((module) => ({ default: module.BarChart })));
const LazyDonutChart = lazy(() => import('@mantine/charts').then((module) => ({ default: module.DonutChart })));
const LazyLineChart = lazy(() => import('@mantine/charts').then((module) => ({ default: module.LineChart })));

type BarChartProps = ComponentProps<typeof LazyBarChart>;
type DonutChartProps = ComponentProps<typeof LazyDonutChart>;
type LineChartProps = ComponentProps<typeof LazyLineChart>;

function ChartFallback({ h }: { h?: number | string }) {
  return <Skeleton height={h ?? 200} radius="sm" />;
}

export function BarChart(props: BarChartProps) {
  return (
    <Suspense fallback={<ChartFallback h={props.h as number | string | undefined} />}>
      <LazyBarChart {...props} />
    </Suspense>
  );
}

export function DonutChart(props: DonutChartProps) {
  return (
    <Suspense fallback={<ChartFallback h={props.h as number | string | undefined} />}>
      <LazyDonutChart {...props} />
    </Suspense>
  );
}

export function LineChart(props: LineChartProps) {
  return (
    <Suspense fallback={<ChartFallback h={props.h as number | string | undefined} />}>
      <LazyLineChart {...props} />
    </Suspense>
  );
}
