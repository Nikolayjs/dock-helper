import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconEdit, IconTrash } from '@tabler/icons-react';

import { SortableTh } from '../../components/common/SortableTh';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { DrugSummary } from './types';

/**
 * The formulary, one drug per row.
 *
 * Trade names sit under the МНН rather than in a column of their own: they are what the patient
 * says and the reason to look a drug up at all, but «Нурофен, Ибуфен, Миг» sorts by nothing useful
 * and a column of them would be mostly empty space.
 *
 * The interaction count earns a column because it is the one number a doctor scans the list for —
 * which of these needs care — and in a grid of cards it was a badge that could not be compared
 * between two drugs sitting in different columns.
 */

export type DrugSortKey = 'inn' | 'brands' | 'category' | 'pharmGroup' | 'atc' | 'interactions';

export const DRUG_SORT_KEYS: readonly DrugSortKey[] = [
  'inn',
  'brands',
  'category',
  'pharmGroup',
  'atc',
  'interactions',
];

interface DrugTableProps {
  drugs: DrugSummary[];
  /** Normalised МНН → how many rules mention it. */
  interactionCounts: Map<string, number>;
  normalizeInn: (inn: string) => string;
  sort: SortState<DrugSortKey>;
  onSort: (key: DrugSortKey) => void;
  onOpen: (drug: DrugSummary) => void;
  onEdit: (drug: DrugSummary) => void;
  onDelete: (drug: DrugSummary) => void;
}

export function drugSortValue(
  drug: DrugSummary,
  key: DrugSortKey,
  interactionCounts: Map<string, number>,
  normalizeInn: (inn: string) => string,
): SortValue {
  switch (key) {
    case 'inn':
      return drug.inn;
    case 'brands':
      // The count, not the text: sorting by «Нурофен» would order the list by whichever trade name
      // happened to be typed first.
      return drug.brandNames.length || null;
    case 'category':
      return drug.category.trim() || null;
    case 'pharmGroup':
      return drug.pharmGroup.trim() || null;
    case 'atc':
      return drug.atcCode.trim() || null;
    case 'interactions':
      return interactionCounts.get(normalizeInn(drug.inn)) || null;
  }
}

export function DrugTable({
  drugs,
  interactionCounts,
  normalizeInn,
  sort,
  onSort,
  onOpen,
  onEdit,
  onDelete,
}: DrugTableProps) {
  return (
    <Table.ScrollContainer minWidth={1100}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <SortableTh column="inn" sort={sort} onSort={onSort} miw={260}>
              МНН
            </SortableTh>
            <SortableTh column="brands" sort={sort} onSort={onSort} w={112}>
              Названий
            </SortableTh>
            <SortableTh column="category" sort={sort} onSort={onSort} miw={230}>
              Раздел
            </SortableTh>
            <SortableTh column="pharmGroup" sort={sort} onSort={onSort} miw={200}>
              Фармгруппа
            </SortableTh>
            <SortableTh column="atc" sort={sort} onSort={onSort} w={104}>
              ATC
            </SortableTh>
            <SortableTh column="interactions" sort={sort} onSort={onSort} w={152}>
              Взаимодействий
            </SortableTh>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {drugs.map((drug) => {
            const interactionCount = interactionCounts.get(normalizeInn(drug.inn)) ?? 0;

            return (
              <Table.Tr key={drug.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(drug)}>
                <Table.Td>
                  <Text fw={600} size="sm" lineClamp={1}>
                    {drug.inn}
                  </Text>
                  {drug.brandNames.length > 0 && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {drug.brandNames.join(', ')}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={drug.brandNames.length === 0 ? 'dimmed' : undefined}>
                    {drug.brandNames.length || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} c={drug.category.trim() ? undefined : 'dimmed'}>
                    {drug.category.trim() || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} c={drug.pharmGroup.trim() ? undefined : 'dimmed'}>
                    {drug.pharmGroup.trim() || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={drug.atcCode.trim() ? undefined : 'dimmed'}>
                    {drug.atcCode.trim() || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {interactionCount > 0 ? (
                    <Badge
                      size="sm"
                      variant="light"
                      color="orange"
                      tt="none"
                      leftSection={<IconAlertTriangle size={12} />}
                    >
                      {interactionCount}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                {/* The row itself opens the drug, so the buttons must not also trigger it. */}
                <Table.Td onClick={(e) => e.stopPropagation()}>
                  <Group gap={2} wrap="nowrap" justify="flex-end">
                    <Tooltip label="Изменить" withArrow>
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(drug)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Удалить" withArrow>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(drug)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
