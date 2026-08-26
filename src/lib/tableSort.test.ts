import { describe, expect, it } from 'vitest';

import { sortRows, type SortState, type SortValue } from './tableSort';

interface Row {
  name: string;
  age: number | null;
  date: string | null;
}

type Key = 'name' | 'age' | 'date';

const valueOf = (row: Row, key: Key): SortValue => row[key];
const asc: SortState<Key> = { key: 'name', direction: 'asc' };

function names(rows: Row[]): string[] {
  return rows.map((row) => row.name);
}

describe('sortRows', () => {
  it('orders Russian text the way a reader expects', () => {
    const rows: Row[] = [
      { name: 'Яковлев', age: null, date: null },
      { name: 'Ёлкин', age: null, date: null },
      { name: 'Ануфриев', age: null, date: null },
      { name: 'ежов', age: null, date: null },
    ];
    // Plain `<` would put «Ёлкин» after «Яковлев» and every capital before every lowercase.
    expect(names(sortRows(rows, asc, valueOf))).toEqual(['Ануфриев', 'ежов', 'Ёлкин', 'Яковлев']);
  });

  it('orders numbers as numbers', () => {
    const rows: Row[] = [
      { name: 'a', age: 10, date: null },
      { name: 'b', age: 2, date: null },
      { name: 'c', age: 33, date: null },
    ];
    const sorted = sortRows(rows, { key: 'age', direction: 'asc' }, valueOf);
    expect(sorted.map((r) => r.age)).toEqual([2, 10, 33]);
  });

  it('flips with the direction', () => {
    const rows: Row[] = [
      { name: 'Б', age: null, date: null },
      { name: 'А', age: null, date: null },
    ];
    expect(names(sortRows(rows, { key: 'name', direction: 'desc' }, valueOf))).toEqual(['Б', 'А']);
  });

  // The point of this rule: clicking «Последний визит» must not fill the screen with patients who
  // have never been seen, in either direction.
  it('keeps blanks at the bottom whichever way it sorts', () => {
    const rows: Row[] = [
      { name: 'нет даты', age: null, date: null },
      { name: 'позже', age: null, date: '2026-05-01' },
      { name: 'пусто', age: null, date: '' },
      { name: 'раньше', age: null, date: '2026-01-01' },
    ];
    expect(names(sortRows(rows, { key: 'date', direction: 'asc' }, valueOf)).slice(0, 2)).toEqual([
      'раньше',
      'позже',
    ]);
    expect(names(sortRows(rows, { key: 'date', direction: 'desc' }, valueOf)).slice(0, 2)).toEqual([
      'позже',
      'раньше',
    ]);
    for (const direction of ['asc', 'desc'] as const) {
      expect(names(sortRows(rows, { key: 'date', direction }, valueOf)).slice(2).sort()).toEqual([
        'нет даты',
        'пусто',
      ]);
    }
  });

  it('leaves the caller array alone', () => {
    const rows: Row[] = [
      { name: 'Б', age: null, date: null },
      { name: 'А', age: null, date: null },
    ];
    sortRows(rows, asc, valueOf);
    expect(names(rows)).toEqual(['Б', 'А']);
  });
});
