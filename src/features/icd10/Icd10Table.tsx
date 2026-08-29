import { Badge, Group, Text } from '@mantine/core';
import { IconNotes } from '@tabler/icons-react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { Icd10ListRow } from './types';

/**
 * Оглавление классификации, по рубрике на строку.
 *
 * Показываются трёхзначные рубрики, а не все 14 641 код: подрубрики отличаются локализацией или
 * уточнением и читаются на карточке своей рубрики, где видны рядом друг с другом. Найти конкретную
 * подрубрику поиск позволяет и так — он ищет по всем кодам.
 */
export type Icd10SortKey = 'code' | 'name' | 'chapter' | 'block' | 'children';

export const ICD10_SORT_KEYS: readonly Icd10SortKey[] = ['code', 'name', 'chapter', 'block', 'children'];

/** Римские номера сортируются как числа: иначе класс XXI встаёт между II и III. */
const ROMAN_ORDER = new Map(
  ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII'].map(
    (roman, index) => [roman, index + 1],
  ),
);

export function icd10SortValue(row: Icd10ListRow, key: Icd10SortKey): SortValue {
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'chapter':
      return ROMAN_ORDER.get(row.chapter) ?? 99;
    case 'block':
      return row.blockRange;
    case 'children':
      return row.children || null;
  }
}

interface Icd10TableProps {
  rows: Icd10ListRow[];
  sort: SortState<Icd10SortKey>;
  onSort: (key: Icd10SortKey) => void;
  onOpen: (row: Icd10ListRow) => void;
}

export function Icd10Table({ rows, sort, onSort, onOpen }: Icd10TableProps) {
  const columns: DataColumn<Icd10ListRow, Icd10SortKey>[] = [
    {
      key: 'code',
      header: 'Код',
      w: 96,
      render: (row) => (
        <Text fw={600} size="sm" ff="monospace">
          {row.code}
        </Text>
      ),
    },
    {
      key: 'name',
      header: 'Наименование',
      miw: 320,
      render: (row) => (
        <Group gap={8} wrap="nowrap">
          <Text size="sm" lineClamp={2}>
            {row.name}
          </Text>
          {/* Отметка о справке — единственное, что отличает строки друг от друга по содержанию,
              и по ней же врач фильтрует список. */}
          {row.hasNote && (
            <IconNotes size={14} style={{ flexShrink: 0, opacity: 0.5 }} aria-label="Есть справка" />
          )}
        </Group>
      ),
    },
    {
      key: 'chapter',
      header: 'Класс',
      w: 88,
      render: (row) => (
        <Badge variant="light" color="gray" size="sm" tt="none">
          {row.chapter}
        </Badge>
      ),
    },
    {
      key: 'block',
      header: 'Блок',
      miw: 240,
      render: (row) => (
        <>
          <Text size="sm" ff="monospace">
            {row.blockRange}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.blockName}
          </Text>
        </>
      ),
    },
    {
      key: 'children',
      header: 'Подрубрик',
      w: 120,
      render: (row) =>
        row.children > 0 ? (
          <Text size="sm">{row.children}</Text>
        ) : (
          // Ноль подрубрик означает, что рубрика сама и есть конечный код: это не пустота,
          // а важный факт при выборе кода для диагноза.
          <Text size="sm" c="dimmed">
            конечный
          </Text>
        ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.code}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={900}
    />
  );
}
