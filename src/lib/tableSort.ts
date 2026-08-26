import { useCallback, useState } from 'react';

/**
 * Sorting a table by clicking its headers.
 *
 * Two decisions are worth stating, because both differ from what `Array.prototype.sort` does on its
 * own and both are visible on the first click.
 *
 * Russian text is compared with `localeCompare`, not by code point: plain `<` puts «Ёлкин» after
 * «Яковлев» and every capital before every lowercase, which in a list of surnames looks like the
 * sort simply failed.
 *
 * Empty values sort last in both directions. A patient with no visits has no last-visit date, and
 * the doctor clicking «Последний визит» wants the most recent or the most overdue at the top —
 * never a screenful of dashes.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** What a row sorts by in a given column. `null` means «nothing here», which always sinks. */
export type SortValue = string | number | null | undefined;

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

function isEmpty(value: SortValue): boolean {
  return value === null || value === undefined || value === '';
}

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  valueOf: (row: T, key: K) => SortValue,
): T[] {
  return [...rows].sort((left, right) => {
    const a = valueOf(left, sort.key);
    const b = valueOf(right, sort.key);
    // Checked before the direction is applied, so blanks stay at the bottom either way.
    if (isEmpty(a) && isEmpty(b)) return 0;
    if (isEmpty(a)) return 1;
    if (isEmpty(b)) return -1;

    const result = compare(a, b);
    return sort.direction === 'asc' ? result : -result;
  });
}

/**
 * Clicking a header sorts by it ascending; clicking the same one again flips the direction — the
 * behaviour a spreadsheet has trained everyone to expect.
 */
export function useTableSort<K extends string>(initial: SortState<K>) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = useCallback((key: K) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }, []);

  return { sort, toggle };
}
