// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import {
  clampSpan,
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
