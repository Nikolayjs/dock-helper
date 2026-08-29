import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconArrowLeft, IconPrinter, IconTableExport } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { computeDispensaryStats, computeStatsByDiagnosis } from '../features/patients/dispensaryStats';
import { buildDispensaryReport } from '../features/patients/dispensaryReport';
import { downloadXlsx } from '../lib/xlsx/downloadXlsx';
import { RankedBarList, type BarItem } from '../components/common/RankedBarList';
import { DispensaryDiagnosisTable } from '../features/patients/DispensaryDiagnosisTable';
import { DispensaryPatientTable } from '../features/patients/DispensaryPatientTable';
import { DispensaryStatsTable } from '../features/patients/DispensaryStatsTable';
import { diagnosisCodeOf, diagnosisLabel, useIcd10Names } from '../features/patients/useIcd10Names';
import { useDispensary } from '../features/patients/useDispensary';
import { usePatients } from '../features/patients/usePatients';

type YearOption = 'current' | 'previous' | 'custom';

/**
 * Age brackets worth one click. A children's clinic reports 0-17 and nothing else, and typing the
 * same two numbers on every visit to the page is the sort of friction that stops a report being run.
 */
type AgeOption = 'all' | 'children' | 'adults' | 'custom';

const AGE_PRESETS: Record<Exclude<AgeOption, 'custom'>, { min?: number; max?: number }> = {
  all: {},
  children: { min: 0, max: 17 },
  adults: { min: 18 },
};

export function DispensaryStatsPage() {
  const { records } = useDispensary();
  const { patients } = usePatients();
  const [yearOption, setYearOption] = useState<YearOption>('current');
  const [ageOption, setAgeOption] = useState<AgeOption>('all');
  const [customMinAge, setCustomMinAge] = useState<number | ''>(0);
  const [customMaxAge, setCustomMaxAge] = useState<number | ''>(17);
  const [sex, setSex] = useState<string | null>(null);
  const [diagnosisFilter, setDiagnosisFilter] = useState<string | null>(null);
  const [hideNames, setHideNames] = useState(false);
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

  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const icdNames = useIcd10Names(records.map((r) => r.diagnosisCode || r.diagnosis));

  /**
   * Everything below is computed from the filtered set, so the headline figures, the chart, the
   * per-diagnosis lines and the patient list can never describe different populations.
   */
  const filtered = useMemo(() => {
    const range = ageOption === 'custom'
      ? { min: customMinAge === '' ? undefined : customMinAge, max: customMaxAge === '' ? undefined : customMaxAge }
      : AGE_PRESETS[ageOption];

    return records.filter((record) => {
      const patient = patientsById.get(record.patientId);
      if (sex && patient?.sex !== sex) return false;
      if (diagnosisFilter && diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames) !== diagnosisFilter) return false;

      if (range.min === undefined && range.max === undefined) return true;
      // Age as of the period end, so re-running last year's report gives last year's answer.
      const birthDate = patient?.birthDate;
      if (!birthDate) return false;
      const age = dayjs(periodEnd).diff(dayjs(birthDate), 'year');
      if (range.min !== undefined && age < range.min) return false;
      if (range.max !== undefined && age > range.max) return false;
      return true;
    });
  }, [records, patientsById, icdNames, ageOption, customMinAge, customMaxAge, sex, diagnosisFilter, periodEnd]);

  const stats = useMemo(() => computeDispensaryStats(filtered, periodStart, periodEnd), [filtered, periodStart, periodEnd]);
  const byDiagnosis = useMemo(
    () => computeStatsByDiagnosis(filtered, periodStart, periodEnd, (r) => diagnosisLabel(r.diagnosis, r.diagnosisCode, icdNames), (r) => diagnosisCodeOf(r.diagnosis, r.diagnosisCode)),
    [filtered, periodStart, periodEnd, icdNames],
  );

  // Named from the whole set, not the filtered one, so choosing a diagnosis never empties the list
  // it was chosen from.
  const diagnosisOptions = useMemo(
    () => [...new Set(records.map((r) => diagnosisLabel(r.diagnosis, r.diagnosisCode, icdNames)).filter(Boolean))].sort(),
    [records, icdNames],
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

  // Отбор словами: он попадает и в выгрузку, и на бумагу. Отчёт, по которому нельзя понять, кого в
  // него включили, приходится пересчитывать заново — а это как раз то, от чего здесь уходят.
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    const range = ageOption === 'custom'
      ? { min: customMinAge === '' ? undefined : customMinAge, max: customMaxAge === '' ? undefined : customMaxAge }
      : AGE_PRESETS[ageOption];
    if (range.min !== undefined || range.max !== undefined) {
      parts.push(`возраст ${range.min ?? 0}–${range.max ?? '∞'}`);
    }
    if (sex) parts.push(sex === 'male' ? 'мужчины' : 'женщины');
    if (diagnosisFilter) parts.push(`диагноз «${diagnosisFilter}»`);
    return parts.length > 0 ? parts.join(', ') : 'без отбора, все карты учёта';
  }, [ageOption, customMinAge, customMaxAge, sex, diagnosisFilter]);

  const handleExport = () =>
    downloadXlsx(
      buildDispensaryReport({
        periodStart,
        periodEnd,
        filters: filterSummary,
        stats,
        byDiagnosis,
        records: filtered,
        patientsById,
        labelOf: (record) => diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames),
        codeOf: (record) => diagnosisCodeOf(record.diagnosis, record.diagnosisCode),
        hideNames,
      }),
    );

  return (
    <Container size="lg" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" align="center" wrap="wrap" gap="sm" className="no-print">
          <Button component={Link} to="/patients" variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
            К списку пациентов
          </Button>
          <Group gap="xs">
            <Button variant="light" leftSection={<IconTableExport size={16} />} onClick={handleExport}>
              Скачать .xlsx
            </Button>
            <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
              Печать
            </Button>
          </Group>
        </Group>

        <Card withBorder padding="md" className="no-print">
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

        <Card withBorder padding="md" className="no-print">
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              Фильтры
            </Text>
            <Group gap="sm" wrap="wrap" align="flex-end">
              <SegmentedControl
                size="xs"
                value={ageOption}
                onChange={(v) => setAgeOption(v as AgeOption)}
                data={[
                  { label: 'Любой возраст', value: 'all' },
                  { label: 'Дети 0–17', value: 'children' },
                  { label: 'Взрослые 18+', value: 'adults' },
                  { label: 'Свой', value: 'custom' },
                ]}
              />
              {ageOption === 'custom' && (
                <>
                  <NumberInput
                    size="xs"
                    w={110}
                    label="Возраст от"
                    min={0}
                    max={120}
                    value={customMinAge}
                    onChange={(v) => setCustomMinAge(v === '' ? '' : Number(v))}
                  />
                  <NumberInput
                    size="xs"
                    w={110}
                    label="до"
                    min={0}
                    max={120}
                    value={customMaxAge}
                    onChange={(v) => setCustomMaxAge(v === '' ? '' : Number(v))}
                  />
                </>
              )}
              <Select
                size="xs"
                w={130}
                label="Пол"
                placeholder="любой"
                data={[
                  { value: 'male', label: 'Мужской' },
                  { value: 'female', label: 'Женский' },
                ]}
                value={sex}
                onChange={setSex}
                clearable
              />
              <Select
                size="xs"
                w={280}
                label="Диагноз"
                placeholder="все диагнозы"
                data={diagnosisOptions}
                value={diagnosisFilter}
                onChange={setDiagnosisFilter}
                searchable
                clearable
              />
            </Group>
            {/* Said out loud: a filtered report that looks like a whole one is a way to mislead
                yourself, and every number on this page moves with these controls. */}
            <Text size="xs" c="dimmed">
              {filtered.length === records.length
                ? `Учтены все карты учёта: ${records.length}`
                : `Отобрано карт учёта: ${filtered.length} из ${records.length} — все цифры ниже относятся к отбору`}
            </Text>
          </Stack>
        </Card>

        {/* Область печати. Отчёт длиннее листа, поэтому печатается потоком, а не как документ
            на один лист: см. правило `.printable-report` в index.css. */}
        <div className="printable-report">
          <div className="print-only" style={{ marginBottom: '1rem' }}>
            <Text fw={700} fz="lg">
              Отчёт по диспансерному наблюдению
            </Text>
            <Text size="sm">
              Период: {dayjs(periodStart).format('D MMMM YYYY')} — {dayjs(periodEnd).format('D MMMM YYYY')}
            </Text>
            <Text size="sm">Отбор: {filterSummary}</Text>
            <Text size="sm">Карт учёта в отчёте: {filtered.length}</Text>
          </div>
          <Stack gap="lg">
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
            <RankedBarList
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
                <RankedBarList items={outcomes} emptyMessage="" />
              </>
            )}
          </Card>

          <Card withBorder padding="lg">
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm" mb="md">
              <div>
                <Text fw={600} mb={2}>
                  Сводный отчёт
                </Text>
                <Text size="xs" c="dimmed">
                  Все пациенты отбора, поимённо
                </Text>
              </div>
              <Switch
                checked={hideNames}
                onChange={(e) => setHideNames(e.currentTarget.checked)}
                label="Скрыть имена"
                description="Останутся диагнозы, пол и возраст"
              />
            </Group>

            <DispensaryPatientTable
              records={filtered}
              patientsById={patientsById}
              icdNames={icdNames}
              hideNames={hideNames}
              asOf={periodEnd}
            />

            <Text fw={600} mt="xl" mb={2}>
              Итоговая форма
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              Те же данные в виде отчётной таблицы
            </Text>
            <div style={{ overflowX: 'auto' }}>
              <DispensaryStatsTable stats={stats} />
            </div>
          </Card>
          </Stack>
        </div>
      </Stack>
    </Container>
  );
}
