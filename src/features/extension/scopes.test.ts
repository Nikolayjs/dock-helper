import { describe, expect, it } from 'vitest';

import { ALL_SERVER_SCOPES, SCOPES, missingScopes } from './scopes';
import type { ExtensionScope } from './useExtensionTokens';

const all = SCOPES.map((scope) => scope.value);

/*
 * Скоуп, которого нет в списке выпуска, — это возможность, которую нельзя включить: ручка на сервере
 * есть, расширение её зовёт, а токен на неё выпустить нечем. Ошибка не падает и ничем себя не
 * выдаёт: врач видит 403 на то, что вчера работало.
 */
describe('список выпуска', () => {
  it('называет каждый скоуп, который знает сервер', () => {
    expect(SCOPES.map((scope) => scope.value).sort()).toEqual([...ALL_SERVER_SCOPES].sort());
  });

  it('у каждого есть подпись словами врача', () => {
    for (const scope of SCOPES) {
      expect(scope.label.length).toBeGreaterThan(3);
      expect(scope.label).not.toContain(':');
    }
  });
});

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
    expect(missingScopes({ scopes: old, revokedAt: null })).toEqual([
      'добавлять ленты новостей и книги по ссылке',
      'передавать файлы анализов в разбор',
    ]);
  });

  it('у отозванного не спрашивается: он не умеет ничего', () => {
    expect(missingScopes({ scopes: [], revokedAt: '2026-09-01T10:00:00.000Z' })).toEqual([]);
  });
});
