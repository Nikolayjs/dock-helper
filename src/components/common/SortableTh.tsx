import type { ReactNode } from 'react';
import { Group, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';

import type { SortState } from '../../lib/tableSort';
import classes from './SortableTh.module.css';

/**
 * A column header that sorts the table when clicked.
 *
 * The idle state carries a faint double arrow rather than nothing at all: a header that only looks
 * clickable once you have already clicked it is a feature nobody finds. The active column shows
 * which way it is going.
 */

interface SortableThProps<K extends string> {
  column: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: ReactNode;
  /** Fixed width, same as passing `w` to a plain `Table.Th`. */
  w?: number;
  /** Lower bound for a column that must not be squeezed out by its fixed neighbours. */
  miw?: number;
}

export function SortableTh<K extends string>({ column, sort, onSort, children, w, miw }: SortableThProps<K>) {
  const active = sort.key === column;
  const Icon = !active ? IconArrowsSort : sort.direction === 'asc' ? IconSortAscending : IconSortDescending;

  return (
    <Table.Th w={w} miw={miw} p={0}>
      <UnstyledButton
        className={classes.button}
        onClick={() => onSort(column)}
        px="sm"
        py="xs"
        w="100%"
        aria-label={`Сортировать по «${typeof children === 'string' ? children : column}»`}
      >
        {/* The arrow hugs the label instead of being pushed to the far edge: in a wide column a
            right-aligned marker reads as belonging to the next column over. */}
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={600} lh={1.3}>
            {children}
          </Text>
          <Icon size={14} opacity={active ? 0.9 : 0.35} style={{ flexShrink: 0 }} />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
