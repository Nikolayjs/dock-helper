import { useMemo, useState } from 'react';
import { Divider, Group, Select, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';

import { LineChart } from '../../components/common/LazyCharts';
import { formatParamValue } from '../analyzer/formatValue';
import type { LabTestDefinition, ParamStatus } from '../analyzer/types';
import { dynamicsOptions, dynamicsSeries, latestRange } from './dynamics';
import type { LabResult } from './types';

const STATUS_WORD: Record<ParamStatus, string> = {
  low: 'ниже нормы',
  high: 'выше нормы',
  normal: 'в норме',
};

const STATUS_COLOR: Record<ParamStatus, string> = {
  low: 'blue',
  high: 'red',
  normal: 'teal',
};

interface LabDynamicsProps {
  results: LabResult[];
  tests: LabTestDefinition[];
}

/**
 * Как показатель менялся от бланка к бланку.
 *
 * То, ради чего анализы и сдают повторно: одно значение отвечает «нормально ли это», ряд —
 * «становится лучше или хуже», а второй вопрос на приёме и есть главный.
 *
 * Показывается, только когда есть хотя бы один показатель из двух бланков. Пустой график с одной
 * точкой — это то же самое число, которое уже стоит в самой записи выше.
 */
export function LabDynamics({ results, tests }: LabDynamicsProps) {
  const options = useMemo(() => dynamicsOptions(results), [results]);
  const [key, setKey] = useState<string | null>(null);
  const active = options.find((option) => option.key === key) ?? options[0];

  const param = useMemo(() => {
    if (!active) return undefined;
    // Показатель ищется по всем анализаторам: один и тот же ключ живёт в своей панели, а бланки
    // пациента бывают от разных.
    for (const test of tests) {
      const found = test.parameters.find((item) => item.key === active.key);
      if (found) return found;
    }
    return undefined;
  }, [active, tests]);

  const points = useMemo(() => (active ? dynamicsSeries(results, active.key, param) : []), [results, active, param]);

  if (!active || points.length < 2) return null;

  const range = latestRange(points);
  const last = points[points.length - 1];
  const decimals = param?.decimals;
  const format = (value: number) => formatParamValue(value, { decimals });

  /**
   * Полоса нормы. `extendDomain` — не украшение: без него recharts строит ось по одним точкам и
   * **выбрасывает** линию, не попавшую в неё (`ifOverflow` по умолчанию `discard`). У графика, где
   * все значения в норме, обе её границы исчезли бы — и понять по нему, что показатель в порядке,
   * стало бы нечем. Считать границы оси самим тоже можно, но тогда деления получаются вида «152,7»:
   * recharts делит заданный диапазон поровну, а сам подбирает круглые.
   */
  const referenceLines = [
    // Подписи смотрят внутрь полосы нормы — вверх у нижней линии, вниз у верхней. Иначе подпись
    // линии, оказавшейся у самого края поля, печатается за его пределами и обрезается карточкой:
    // а у графика, где все значения в норме, обе линии стоят ровно по краям.
    range.min !== undefined
      ? { y: range.min, label: `Норма от ${format(range.min)}`, labelPosition: 'insideBottomLeft' as const }
      : null,
    range.max !== undefined
      ? { y: range.max, label: `Норма до ${format(range.max)}`, labelPosition: 'insideTopLeft' as const }
      : null,
  ]
    .filter((line) => line !== null)
    .map((line) => ({ ...line, color: 'gray.5', ifOverflow: 'extendDomain' as const }));

  return (
    <Stack gap="sm" mt="xs">
      <Divider />
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Text fw={600} size="sm">
          Динамика показателя
        </Text>
        <Select
          data={options.map((option) => ({ value: option.key, label: `${option.label} · ${option.count}` }))}
          value={active.key}
          onChange={setKey}
          size="xs"
          w={260}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true }}
          aria-label="Показатель для динамики"
        />
      </Group>

      <LineChart
        h={220}
        data={points.map((point) => ({ date: dayjs(point.date).format('DD.MM.YY'), value: point.value }))}
        dataKey="date"
        series={[{ name: 'value', label: active.label, color: 'brand.6' }]}
        curveType="linear"
        valueFormatter={format}
        // Единица стоит подписью к оси, а не у каждого деления: с ней «152,7 г/л» переносится на
        // две строки и превращает шкалу в частокол.
        yAxisLabel={active.unit}
        // Ось не начинается с нуля, и это осознанно: по умолчанию recharts тянет её к нулю, и
        // гемоглобин 96–112 при норме 120–150 ложился в верхнюю треть рисунка — изменение, ради
        // которого график и рисуют, становилось неразличимым. Ноль обязателен там, где длина
        // столбика и есть величина; здесь величину показывает положение точки относительно нормы,
        // а норма нарисована.
        yAxisProps={{ width: 44, domain: ['auto', 'auto'] }}
        referenceLines={referenceLines}
        strokeWidth={2}
        dotProps={{ r: 4, strokeWidth: 2 }}
        withLegend={false}
      />

      {/* Отклонение названо словами, а не только цветом точки: тот, кто цвета не различает,
          прочитает то же самое. Норма стоит рядом — число без неё ничего не значит. */}
      <Text size="sm" c="dimmed">
        Последнее значение {dayjs(last.date).format('D MMMM YYYY')}:{' '}
        <Text span fw={600} c={last.status ? STATUS_COLOR[last.status] : undefined}>
          {format(last.value)}
          {active.unit ? ` ${active.unit}` : ''}
        </Text>
        {last.status ? ` — ${STATUS_WORD[last.status]}` : ' — норма для этого показателя не задана'}
        {range.min !== undefined || range.max !== undefined
          ? ` (норма ${range.min !== undefined ? format(range.min) : '…'}–${range.max !== undefined ? format(range.max) : '…'})`
          : ''}
      </Text>
    </Stack>
  );
}
