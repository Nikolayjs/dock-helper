/**
 * One card, three ways of looking at the same people: what they come with, how old they are, and
 * who they are. Which one is shown is the doctor's choice and is kept with the layout.
 *
 * Each cut gets the form its own question deserves. Diagnoses are a ranking, so they are bars with
 * the names beside them — a donut of twenty diseases ranks nothing. Age is an ordered scale, so it
 * is a column chart in band order, never sorted by size, because the shape of the distribution *is*
 * the answer. Sex is two or three parts of one whole, which is the one case a donut earns.
 */
import { BarChart, DonutChart } from '../../components/common/LazyCharts';
import { Group, SegmentedControl, Stack, Text } from '@mantine/core';

import { RankedBarList, type BarItem } from '../../components/common/RankedBarList';
import type { Slice } from './practice';
import { STRUCTURE_MODES, type StructureMode } from './structureMode';

/**
 * Мужчины и женщины — та самая проверенная пара (ΔE 32 при протанопии, ≥3:1 к фону в обеих темах).
 * «Не указан» намеренно серый: это не третья категория наравне с ними, а признание пробела в данных.
 */
const SEX_COLORS: Record<string, string> = {
  Мужчины: 'brand.6',
  Женщины: 'orange.8',
  'Не указан': 'gray.5',
};

interface PatientStructureProps {
  mode: StructureMode;
  onModeChange: (mode: StructureMode) => void;
  diagnoses: BarItem[];
  age: Slice[];
  sex: Slice[];
  /** Пациенты без даты рождения — в возрастной разрез они не попали. */
  undatedCount: number;
}

function SubHeading({ children }: { children: string }) {
  return (
    <Text size="sm" fw={600} c="dimmed" mt="md">
      {children}
    </Text>
  );
}

function AgeChart({ age, undatedCount }: { age: Slice[]; undatedCount: number }) {
  const total = age.reduce((sum, band) => sum + band.value, 0);
  if (total === 0) {
    return (
      <Text size="sm" c="dimmed">
        Не у кого посчитать: ни у одного пациента не указана дата рождения.
      </Text>
    );
  }

  return (
    <>
      {/* Одна серия — легенду называет заголовок карточки. */}
      <BarChart
        h={220}
        data={age}
        dataKey="label"
        series={[{ name: 'value', color: 'brand.6', label: 'Пациентов' }]}
        withLegend={false}
        gridAxis="y"
        tickLine="none"
      />
      {undatedCount > 0 && (
        <Text size="xs" c="dimmed" mt="xs">
          Без даты рождения: {undatedCount} — в график не вошли
        </Text>
      )}
    </>
  );
}

function SexChart({ sex }: { sex: Slice[] }) {
  const total = sex.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <Text size="sm" c="dimmed">
        Пока нет пациентов.
      </Text>
    );
  }

  const data = sex.map((item) => ({
    name: item.label,
    value: item.value,
    color: SEX_COLORS[item.label] ?? 'gray.5',
  }));

  return (
    <Group align="center" wrap="wrap" gap="xl">
      <DonutChart data={data} h={180} withLabelsLine withLabels />
      <Stack gap={6} style={{ flex: '1 1 160px', minWidth: 150 }}>
        {data.map((item) => (
          <Group key={item.name} justify="space-between">
            <Group gap={8}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: `var(--mantine-color-${item.color.replace('.', '-')})`,
                }}
              />
              <Text size="sm">{item.name}</Text>
            </Group>
            <Text size="sm" c="dimmed">
              {item.value} · {Math.round((item.value / total) * 100)}%
            </Text>
          </Group>
        ))}
      </Stack>
    </Group>
  );
}

export function PatientStructure({ mode, onModeChange, diagnoses, age, sex, undatedCount }: PatientStructureProps) {
  const showAll = mode === 'all';

  return (
    <Stack gap="sm">
      <SegmentedControl
        value={mode}
        onChange={(value) => onModeChange(value as StructureMode)}
        data={STRUCTURE_MODES}
        size="xs"
      />

      {(showAll || mode === 'diagnoses') && (
        <>
          {showAll && <SubHeading>Диагнозы</SubHeading>}
          <RankedBarList
            items={diagnoses}
            limit={showAll ? 5 : 8}
            emptyMessage="Пока не из чего построить: у визитов не заполнен диагноз."
            tailLabel={(count) => `Остальные диагнозы (${count})`}
          />
        </>
      )}

      {(showAll || mode === 'age') && (
        <>
          {showAll && <SubHeading>Возраст</SubHeading>}
          <AgeChart age={age} undatedCount={undatedCount} />
        </>
      )}

      {(showAll || mode === 'sex') && (
        <>
          {showAll && <SubHeading>Пол</SubHeading>}
          <SexChart sex={sex} />
        </>
      )}
    </Stack>
  );
}
