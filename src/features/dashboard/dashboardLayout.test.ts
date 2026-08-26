// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPTY_LAYOUT, moveWidget, orderWidgets, readLayout, STORAGE_KEY, writeLayout } from './dashboardLayout';
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
    writeLayout({ order: ['b', 'a'], hidden: ['c'] });
    expect(readLayout()).toEqual({ order: ['b', 'a'], hidden: ['c'] });
  });

  it('falls back to the default when storage holds nonsense', () => {
    // A corrupted preference must never take the dashboard down with it.
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readLayout()).toEqual(EMPTY_LAYOUT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order: 'нет', hidden: [1, 2] }));
    expect(readLayout()).toEqual(EMPTY_LAYOUT);
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
