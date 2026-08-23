import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconArrowLeft } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { computeDispensaryStats } from '../features/patients/dispensaryStats';
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

  return (
    <Container size="lg" px={0}>
      <Stack gap="lg">
        <Button component={Link} to="/patients" variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          К списку пациентов
        </Button>

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Title order={3}>Статистика диспансерного наблюдения</Title>
        </Group>

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

        <div style={{ overflowX: 'auto' }}>
          <DispensaryStatsTable stats={stats} />
        </div>
      </Stack>
    </Container>
  );
}
