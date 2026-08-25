import { Table, Text } from '@mantine/core';

import type { DiagnosisStats, DispensaryStats } from './dispensaryStats';

/**
 * The report, one line per disease, with the aggregate repeated as a totals row.
 *
 * The totals are recomputed over every record rather than summed from the lines above, so the two
 * can only agree — and a diagnosis dropped from the lines for having no activity in the period
 * still cannot make the bottom row wrong.
 */

interface DispensaryDiagnosisTableProps {
  rows: DiagnosisStats[];
  totals: DispensaryStats;
}

export function DispensaryDiagnosisTable({ rows, totals }: DispensaryDiagnosisTableProps) {
  if (rows.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        За выбранный период нет ни одной карты диспансерного учёта.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={860}>
      <Table withTableBorder withColumnBorders striped ta="center" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th rowSpan={2} ta="left">
              Диагноз
            </Table.Th>
            <Table.Th rowSpan={2}>Код МКБ</Table.Th>
            <Table.Th colSpan={2}>Состояло / взято</Table.Th>
            <Table.Th colSpan={3}>Снято</Table.Th>
            <Table.Th rowSpan={2}>Состоит</Table.Th>
          </Table.Tr>
          <Table.Tr>
            <Table.Th>Состояло</Table.Th>
            <Table.Th>Взято</Table.Th>
            <Table.Th>Выздоровление</Table.Th>
            <Table.Th>Выбыл</Table.Th>
            <Table.Th>Всего</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.diagnosis}>
              <Table.Td ta="left">{row.diagnosis}</Table.Td>
              <Table.Td c={row.diagnosisCode ? undefined : 'dimmed'}>{row.diagnosisCode ?? '—'}</Table.Td>
              <Table.Td>{row.consisted}</Table.Td>
              <Table.Td>{row.taken}</Table.Td>
              <Table.Td>{row.recoveredRemoved}</Table.Td>
              <Table.Td>{row.leftRemoved}</Table.Td>
              <Table.Td>{row.totalRemoved}</Table.Td>
              <Table.Td fw={600}>{row.consists}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th ta="left">Всего</Table.Th>
            <Table.Th />
            <Table.Th>{totals.consisted}</Table.Th>
            <Table.Th>{totals.taken}</Table.Th>
            <Table.Th>{totals.recoveredRemoved}</Table.Th>
            <Table.Th>{totals.leftRemoved}</Table.Th>
            <Table.Th>{totals.totalRemoved}</Table.Th>
            <Table.Th>{totals.consists}</Table.Th>
          </Table.Tr>
        </Table.Tfoot>
      </Table>
    </Table.ScrollContainer>
  );
}
