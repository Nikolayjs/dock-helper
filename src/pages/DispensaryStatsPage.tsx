import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconArrowLeft } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { computeDispensaryStats, computeStatsByDiagnosis } from '../features/patients/dispensaryStats';
import { DispensaryDiagnosisChart, type BarItem } from '../features/patients/DispensaryDiagnosisChart';
import { DispensaryDiagnosisTable } from '../features/patients/DispensaryDiagnosisTable';
import { DispensaryStatsTable } from '../features/patients/DispensaryStatsTable';
import { useDispensary } from '../features/patients/useDispensary';

type YearOption = 'current' | 'previous' | 'custom';

export function DispensaryStatsPage() {
  const { records } = useDispensary();
  const [yearOption, setYearOption] = useState<YearOption>('current');
  const [customStart, setCustomStart] = useState<string>(dayjs().startOf('year').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState<string>(dayjs().endOf('year').format('YYYY-MM-DD'));

  const { periodStart, periodEnd } = useMemo(() => {
    if (yearOption === 'current') {
      return { periodStart: dayjs().startOf('year').format('YYYY-MM-DD'), periodEnd: dayjs().endOf('year').format('YYYY-MM-DD') };
    }
    if (yearOption === 'previous') {
      const prevYear = dayjs().subtract(1, 'year');
      return { periodStart: prevYear.startOf('year').format('YYYY-MM-DD'), periodEnd: prevYear.endOf('year').format('YYYY-MM-DD') };
    }
    return { periodStart: customStart, periodEnd: customEnd };
  }, [yearOption, customStart, customEnd]);

  const stats = useMemo(() => computeDispensaryStats(records, periodStart, periodEnd), [records, periodStart, periodEnd]);
  const byDiagnosis = useMemo(
    () => computeStatsByDiagnosis(records, periodStart, periodEnd),
    [records, periodStart, periodEnd],
  );

  // The five outcomes come from observations recorded during the period. A register that has only
  // just been loaded has none, and five zeroes drawn as a chart say less than one sentence does.
  const outcomes: BarItem[] = [
    { label: 'Выздоровление', value: stats.effectiveness.recovered },
    { label: 'Улучшение', value: stats.effectiveness.improved },
    { label: 'Без перемен', value: stats.effectiveness.unchanged },
    { label: 'Ухудшение', value: stats.effectiveness.worsened },
    { label: 'Смертность', value: stats.effectiveness.death },
  ];
  const outcomesTotal = outcomes.reduce((sum, o) => sum + o.value, 0);

  return (
    <Container size="lg" px={0}>
      <Stack gap="lg">
        <Button component={Link} to="/patients" variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          К списку пациентов
        </Button>

        <Card withBorder padding="md">
          <Stack gap="sm">
            <SegmentedControl
              value={yearOption}
              onChange={(v) => setYearOption(v as YearOption)}
              data={[
                { label: `${dayjs().year()} год`, value: 'current' },
                { label: `${dayjs().year() - 1} год`, value: 'previous' },
                { label: 'Свой период', value: 'custom' },
              ]}
            />
            {yearOption === 'custom' && (
              <Group grow align="flex-start">
                <DatePickerInput label="С" value={customStart} onChange={(v) => setCustomStart((v as string | null) ?? customStart)} valueFormat="D MMMM YYYY" />
                <DatePickerInput label="По" value={customEnd} onChange={(v) => setCustomEnd((v as string | null) ?? customEnd)} valueFormat="D MMMM YYYY" />
              </Group>
            )}
            <Text size="xs" c="dimmed">
              Период: {dayjs(periodStart).format('D MMMM YYYY')} — {dayjs(periodEnd).format('D MMMM YYYY')}
            </Text>
          </Stack>
        </Card>

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          {[
            { label: 'Состоит на учёте', value: stats.consists },
            { label: 'Взято за период', value: stats.taken },
            { label: 'Снято за период', value: stats.totalRemoved },
            { label: 'Диагнозов', value: byDiagnosis.length },
          ].map((tile) => (
            <Card key={tile.label} withBorder padding="md">
              <Text size="xs" c="dimmed">
                {tile.label}
              </Text>
              <Text fz={32} fw={700} lh={1.1} mt={4}>
                {tile.value}
              </Text>
            </Card>
          ))}
        </SimpleGrid>

        <Card withBorder padding="lg">
          <Text fw={600} mb={2}>
            Состоит на учёте по диагнозам
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            На конец периода, от большего к меньшему
          </Text>
          <DispensaryDiagnosisChart
            items={byDiagnosis.map((row) => ({ label: row.diagnosis, value: row.consists, code: row.diagnosisCode }))}
            emptyMessage="За выбранный период на учёте никто не состоит."
            tailLabel={(count) => `Остальные диагнозы (${count})`}
          />
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb={2}>
            По диагнозам
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Те же графы отчёта, разложенные по заболеваниям
          </Text>
          <DispensaryDiagnosisTable rows={byDiagnosis} totals={stats} />
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb={2}>
            Исходы наблюдения
          </Text>
          {outcomesTotal === 0 ? (
            <Text size="sm" c="dimmed">
              За период не отмечено ни одного осмотра с исходом — заполняются в карте диспансерного учёта.
            </Text>
          ) : (
            <>
              <Text size="xs" c="dimmed" mb="md">
                По последнему осмотру каждого пациента за период
              </Text>
              {/* Five named categories compared by size — one series, so identity rides on the
                  labels and no pair of hues has to be told apart. */}
              <DispensaryDiagnosisChart items={outcomes} emptyMessage="" />
            </>
          )}
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb={2}>
            Сводный отчёт
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Итоговая форма за период
          </Text>
          <div style={{ overflowX: 'auto' }}>
            <DispensaryStatsTable stats={stats} />
          </div>
        </Card>
      </Stack>
    </Container>
  );
}
