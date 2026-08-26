// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clampSpan,
  compactLayout,
  EMPTY_LAYOUT,
  MAX_SPAN,
  MIN_SPAN,
  moveWidget,
  orderWidgets,
  readLayout,
  STORAGE_KEY,
  writeLayout,
} from './dashboardLayout';
import { DASHBOARD_WIDGETS } from './widgets';

const catalogue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

beforeEach(() => {
  localStorage.clear();
});

describe('orderWidgets', () => {
  it('follows the stored order', () => {
    expect(orderWidgets(catalogue, ['c', 'a', 'b']).map((w) => w.id)).toEqual(['c', 'a', 'b']);
  });

  it('appends a widget the stored order has never heard of', () => {
    // A card added in a later release must turn up for the doctors who customised long ago —
    // they are exactly the ones it would otherwise be invisible to.
    expect(orderWidgets(catalogue, ['c']).map((w) => w.id)).toEqual(['c', 'a', 'b']);
  });

  it('drops an id that is no longer in the catalogue', () => {
    expect(orderWidgets(catalogue, ['b', 'removed-long-ago', 'a']).map((w) => w.id)).toEqual(['b', 'a', 'c']);
  });

  it('returns the catalogue untouched when nothing is stored', () => {
    expect(orderWidgets(catalogue, []).map((w) => w.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('moveWidget', () => {
  it('moves a card down to where the target sits', () => {
    expect(moveWidget(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('moves a card up', () => {
    expect(moveWidget(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('leaves the order alone when the card did not actually move', () => {
    const order = ['a', 'b', 'c'];
    expect(moveWidget(order, 'b', 'b')).toBe(order);
    expect(moveWidget(order, 'b', 'unknown')).toBe(order);
  });
});

describe('readLayout', () => {
  it('round-trips what was written', () => {
    writeLayout({ order: ['b', 'a'], hidden: ['c'], spans: { a: 6 }, settings: { s: 'age' } });
    expect(readLayout()).toEqual({ order: ['b', 'a'], hidden: ['c'], spans: { a: 6 }, settings: { s: 'age' } });
  });

  it('falls back to the default when storage holds nonsense', () => {
    // A corrupted preference must never take the dashboard down with it.
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readLayout()).toEqual(EMPTY_LAYOUT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: 'нет', hidden: [1, 2] }));
    expect(readLayout()).toEqual(EMPTY_LAYOUT);
  });

  it('reads a layout saved before widths and per-card choices existed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: ['b'], hidden: [] }));
    expect(readLayout()).toEqual({ order: ['b'], hidden: [], spans: {}, settings: {} });
  });

  it('keeps only per-card choices that are strings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: { a: 'age', b: 7, c: null } }));
    expect(readLayout().settings).toEqual({ a: 'age' });
  });

  it('keeps only widths that are numbers, and pulls them into range', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ spans: { a: 99, b: 0, c: 'широко', d: 6 } }));
    expect(readLayout().spans).toEqual({ a: 12, b: 3, d: 6 });
  });
});

describe('clampSpan', () => {
  it('keeps a card between a quarter of the grid and the whole of it', () => {
    expect(clampSpan(1)).toBe(MIN_SPAN);
    expect(clampSpan(50)).toBe(MAX_SPAN);
    expect(clampSpan(6)).toBe(6);
    expect(clampSpan(6.4)).toBe(6);
    expect(clampSpan(Number.NaN)).toBe(MIN_SPAN);
  });
});

describe('widget catalogue', () => {
  it('has no duplicate ids — the stored order addresses cards by id', () => {
    const ids = DASHBOARD_WIDGETS.map((widget) => widget.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every widget a span that fits the twelve-column grid', () => {
    for (const widget of DASHBOARD_WIDGETS) {
      expect(widget.span).toBeGreaterThan(0);
      expect(widget.span).toBeLessThanOrEqual(12);
    }
  });

  it('describes every widget, because the settings panel is the only place a card is named', () => {
    for (const widget of DASHBOARD_WIDGETS) {
      expect(widget.title.length).toBeGreaterThan(0);
      expect(widget.description.length).toBeGreaterThan(0);
    }
  });
});

describe('compactLayout', () => {
  const items = (...pairs: [string, number][]) => pairs.map(([id, span]) => ({ id, span }));

  it('fills every row to exactly twelve', () => {
    const { order, spans } = compactLayout(items(['a', 8], ['b', 8], ['c', 4], ['d', 4]));
    // 8 + 4 закрывает ряд; вторая восьмёрка уходит во второй ряд и добирает оставшуюся четвёрку.
    expect(order).toEqual(['a', 'c', 'b', 'd']);
    expect(spans).toEqual({ a: 8, c: 4, b: 8, d: 4 });
  });

  it('stretches a row that has nothing left to pull in', () => {
    const { order, spans } = compactLayout(items(['a', 8]));
    expect(order).toEqual(['a']);
    expect(spans).toEqual({ a: 12 });
  });

  it('spreads the remainder around the row rather than onto one card', () => {
    // Три тройки становятся тремя четвёрками, а не тройкой, тройкой и шестёркой.
    expect(compactLayout(items(['a', 3], ['b', 3], ['c', 3])).spans).toEqual({ a: 4, b: 4, c: 4 });
  });

  it('leaves a layout that already tiles alone', () => {
    const source = items(['a', 6], ['b', 6], ['c', 4], ['d', 4], ['e', 4]);
    const { order, spans } = compactLayout(source);
    expect(order).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(spans).toEqual({ a: 6, b: 6, c: 4, d: 4, e: 4 });
  });

  it('keeps full-width cards full width', () => {
    expect(compactLayout(items(['a', 12], ['b', 12])).spans).toEqual({ a: 12, b: 12 });
  });

  it('takes the earliest card that fits, so the order moves as little as possible', () => {
    expect(compactLayout(items(['a', 8], ['b', 8], ['c', 4], ['d', 8], ['e', 4])).order).toEqual([
      'a',
      'c',
      'b',
      'e',
      'd',
    ]);
  });

  it('never loses or duplicates a card, and never leaves a row short', () => {
    const source = items(['a', 3], ['b', 7], ['c', 5], ['d', 12], ['e', 4], ['f', 6], ['g', 3]);
    const { order, spans } = compactLayout(source);

    expect(order).toHaveLength(source.length);
    expect(new Set(order)).toEqual(new Set(source.map((item) => item.id)));

    // Пройдёмся рядами по итогу: каждый ряд обязан быть ровно двенадцатью.
    let row = 0;
    for (const id of order) {
      row += spans[id];
      expect(row).toBeLessThanOrEqual(12);
      if (row === 12) row = 0;
    }
    expect(row).toBe(0);
  });

  it('handles an empty dashboard', () => {
    expect(compactLayout([])).toEqual({ order: [], spans: {} });
  });
});
