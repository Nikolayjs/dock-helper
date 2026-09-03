import { describe, expect, it } from 'vitest';

import { SCOPES, missingScopes } from './scopes';
import type { ExtensionScope } from './useExtensionTokens';

const all = SCOPES.map((scope) => scope.value);

describe('чего не умеет токен', () => {
  it('свежий токен умеет всё, что есть сейчас', () => {
    expect(missingScopes({ scopes: all, revokedAt: null })).toEqual([]);
  });

  /*
   * Ровно тот случай, ради которого пометка и заведена: токен, выпущенный прошлым релизом, на новом
   * действии не отказывает внятно — он отвечает 403 из глубины охранника, и со стороны врача это
   * «расширение перестало работать».
   */
  it('токен, выданный раньше, назван поимённо', () => {
    const old = ['clips:write', 'catalog:read'] as ExtensionScope[];
    expect(missingScopes({ scopes: old, revokedAt: null })).toEqual(['добавлять ленты новостей и книги по ссылке']);
  });

  it('у отозванного не спрашивается: он не умеет ничего', () => {
    expect(missingScopes({ scopes: [], revokedAt: '2026-09-01T10:00:00.000Z' })).toEqual([]);
  });
});
