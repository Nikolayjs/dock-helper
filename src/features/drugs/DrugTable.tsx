import { ActionIcon, Badge, Group, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconEdit, IconTrash } from '@tabler/icons-react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { DrugSummary } from './types';

/**
 * Формуляр, по препарату на строку.
 *
 * Торговые названия стоят под МНН, а не отдельным столбцом: их называет пациент и ради них
 * справочник и открывают, но «Нурофен, Ибуфен, Миг» не сортируется ни по чему полезному, а столбец
 * из них был бы наполовину пустым.
 *
 * Число взаимодействий столбец заслуживает: это единственная цифра, ради которой список
 * просматривают глазами — у кого из них есть о чём подумать.
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
  /** Нормализованное МНН → сколько правил его упоминают. */
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
      // Количество, а не текст: сортировка по «Нурофену» упорядочила бы список по тому торговому
      // названию, которое случайно набрали первым.
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

/** Прочерк вместо пустоты: пустая ячейка читается как «ещё не посмотрели», прочерк — как «нет». */
function dashed(value: string) {
  return (
    <Text size="sm" lineClamp={1} c={value.trim() ? undefined : 'dimmed'}>
      {value.trim() || '—'}
    </Text>
  );
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
  const columns: DataColumn<DrugSummary, DrugSortKey>[] = [
    {
      key: 'inn',
      header: 'МНН',
      miw: 260,
      render: (drug) => (
        <>
          <Text fw={600} size="sm" lineClamp={1}>
            {drug.inn}
          </Text>
          {drug.brandNames.length > 0 && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {drug.brandNames.join(', ')}
            </Text>
          )}
        </>
      ),
    },
    {
      key: 'brands',
      header: 'Названий',
      w: 112,
      render: (drug) => (
        <Text size="sm" c={drug.brandNames.length === 0 ? 'dimmed' : undefined}>
          {drug.brandNames.length || '—'}
        </Text>
      ),
    },
    { key: 'category', header: 'Раздел', miw: 230, render: (drug) => dashed(drug.category) },
    { key: 'pharmGroup', header: 'Фармгруппа', miw: 200, render: (drug) => dashed(drug.pharmGroup) },
    { key: 'atc', header: 'ATC', w: 104, render: (drug) => dashed(drug.atcCode) },
    {
      key: 'interactions',
      header: 'Взаимодействий',
      w: 152,
      render: (drug) => {
        const count = interactionCounts.get(normalizeInn(drug.inn)) ?? 0;
        return count > 0 ? (
          <Badge size="sm" variant="light" color="orange" tt="none" leftSection={<IconAlertTriangle size={12} />}>
            {count}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            {'—'}
          </Text>
        );
      },
    },
    {
      w: 80,
      stopClick: true,
      render: (drug) => (
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
      ),
    },
  ];

  return (
    <DataTable
      rows={drugs}
      columns={columns}
      rowKey={(drug) => drug.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={1100}
    />
  );
}
