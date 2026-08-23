import { Table } from '@mantine/core';

import type { DispensaryStats } from './dispensaryStats';

interface DispensaryStatsTableProps {
  stats: DispensaryStats;
}

export function DispensaryStatsTable({ stats }: DispensaryStatsTableProps) {
  return (
    <Table withTableBorder withColumnBorders ta="center" style={{ tableLayout: 'auto' }}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th colSpan={5}>Снято</Table.Th>
          <Table.Th colSpan={5}>Эффективность</Table.Th>
          <Table.Th colSpan={3}>Оздоровление</Table.Th>
        </Table.Tr>
        <Table.Tr>
          <Table.Th>Состояло</Table.Th>
          <Table.Th>Взято</Table.Th>
          <Table.Th>Выздоровление</Table.Th>
          <Table.Th>Выбыл</Table.Th>
          <Table.Th>Состоит</Table.Th>
          <Table.Th>Ухудшение</Table.Th>
          <Table.Th>Улучшение</Table.Th>
          <Table.Th>Выздоровление</Table.Th>
          <Table.Th>Без перемен</Table.Th>
          <Table.Th>Смертность</Table.Th>
          <Table.Th>ОВЛ</Table.Th>
          <Table.Th>Санатории</Table.Th>
          <Table.Th>Лагеря/базы отдыха</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        <Table.Tr>
          <Table.Td>{stats.consisted}</Table.Td>
          <Table.Td>{stats.taken}</Table.Td>
          <Table.Td>{stats.recoveredRemoved}</Table.Td>
          <Table.Td>{stats.leftRemoved}</Table.Td>
          <Table.Td>{stats.consists}</Table.Td>
          <Table.Td>{stats.effectiveness.worsened}</Table.Td>
          <Table.Td>{stats.effectiveness.improved}</Table.Td>
          <Table.Td>{stats.effectiveness.recovered}</Table.Td>
          <Table.Td>{stats.effectiveness.unchanged}</Table.Td>
          <Table.Td>{stats.effectiveness.death}</Table.Td>
          <Table.Td>{stats.ovl}</Table.Td>
          <Table.Td>{stats.sanatorium}</Table.Td>
          <Table.Td>{stats.campRest}</Table.Td>
        </Table.Tr>
      </Table.Tbody>
    </Table>
  );
}
