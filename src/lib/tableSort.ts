import { useCallback, useEffect, useState } from 'react';
import { readSetting, writeSetting } from './settingsStore';

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
 * Remembering the chosen sort between visits.
 *
 * Validated on the way in rather than trusted. A stored key that no longer names a column would
 * leave `sortRows` reading `undefined` out of every row — which is not an error but «everything is
 * blank», so the table would come up in whatever order the server sent and look unsorted for no
 * visible reason.
 */
export function parseStoredSort<K extends string>(raw: string | null, keys: readonly K[]): SortState<K> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SortState<K>> | null;
    if (!parsed || !keys.includes(parsed.key as K)) return null;
    if (parsed.direction !== 'asc' && parsed.direction !== 'desc') return null;
    return { key: parsed.key as K, direction: parsed.direction };
  } catch {
    return null;
  }
}

function readStored<K extends string>(storageKey: string, keys: readonly K[]): SortState<K> | null {
  try {
    return parseStoredSort(readSetting(storageKey), keys);
  } catch {
    // Private mode denies localStorage outright; the table just opens on its default.
    return null;
  }
}

export interface SortPersistence<K extends string> {
  storageKey: string;
  /** Every key the table accepts, so a renamed column falls back instead of sorting by nothing. */
  keys: readonly K[];
}

/**
 * Clicking a header sorts by it ascending; clicking the same one again flips the direction — the
 * behaviour a spreadsheet has trained everyone to expect.
 *
 * With `persist`, the choice survives a reload: a doctor who works through the register by nearest
 * appointment should not have to re-sort it every morning.
 */
export function useTableSort<K extends string>(initial: SortState<K>, persist?: SortPersistence<K>) {
  const [sort, setSort] = useState<SortState<K>>(
    () => (persist ? readStored(persist.storageKey, persist.keys) : null) ?? initial,
  );

  const storageKey = persist?.storageKey;
  useEffect(() => {
    if (!storageKey) return;
    try {
      writeSetting(storageKey, JSON.stringify(sort));
    } catch {
      // Nothing to do about a full or blocked store — the sort still works for this session.
    }
  }, [storageKey, sort]);

  const toggle = useCallback((key: K) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  }, []);

  return { sort, toggle };
}
