import { beforeEach, describe, expect, it } from 'vitest';

import { rankTemplates, readUsage, recordTemplateUse, STORAGE_KEY } from './documentUsage';

beforeEach(() => {
  localStorage.clear();
});

describe('recordTemplateUse', () => {
  it('counts each use', () => {
    recordTemplateUse('a');
    recordTemplateUse('a');
    recordTemplateUse('b');

    const usage = readUsage();
    expect(usage.a.count).toBe(2);
    expect(usage.b.count).toBe(1);
    expect(usage.a.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('keeps only the busiest, so the record cannot grow without bound', () => {
    for (let i = 0; i < 60; i += 1) recordTemplateUse(`t${i}`);
    expect(Object.keys(readUsage()).length).toBeLessThanOrEqual(40);
  });
});

describe('readUsage', () => {
  it('survives nonsense in storage', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(readUsage()).toEqual({});
  });

  it('drops entries that are not a usable count', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ok: { count: 3, lastUsedAt: '2026-08-01T00:00:00Z' }, bad: { count: 'много' }, zero: { count: 0 } }),
    );
    expect(Object.keys(readUsage())).toEqual(['ok']);
  });
});

describe('rankTemplates', () => {
  it('ranks by use and forgets templates that were deleted', () => {
    // Иначе в списке остаётся строка, ведущая в никуда.
    const usage = {
      kept: { count: 5, lastUsedAt: '2026-08-01T00:00:00Z' },
      gone: { count: 99, lastUsedAt: '2026-08-02T00:00:00Z' },
      rare: { count: 1, lastUsedAt: '2026-08-03T00:00:00Z' },
    };
    const ranked = rankTemplates(usage, new Set(['kept', 'rare']));
    expect(ranked.map((r) => r.id)).toEqual(['kept', 'rare']);
  });

  it('breaks a tie by which was used more recently', () => {
    const usage = {
      older: { count: 2, lastUsedAt: '2026-01-01T00:00:00Z' },
      newer: { count: 2, lastUsedAt: '2026-08-01T00:00:00Z' },
    };
    expect(rankTemplates(usage, new Set(['older', 'newer']))[0].id).toBe('newer');
  });
});
