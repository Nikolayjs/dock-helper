import { describe, expect, it } from 'vitest';

import { MAX_SYNCED_LENGTH, isSyncable, isSyncedKey } from './settingsStore';

/**
 * Что уезжает на сервер, а что остаётся на устройстве.
 *
 * Ошибка в любую сторону тихая: лишний ключ увозит на сервер то, чему там не место, а пропущенный
 * оставляет настройку принадлежать браузеру — ровно та беда, ради которой синхронизация и заводится.
 */
describe('какие настройки синхронизируются', () => {
  it('раскладка, меню, читалка и подсказки — да', () => {
    for (const key of [
      'medassist:dashboard-layout',
      'medassist:sidebar-order',
      'medassist:sidebar-width',
      'medassist:library:reader-prefs',
      'medassist:document-usage',
      'medassist:drugs:intro-hidden',
      'medassist:patients-disclaimer-dismissed',
    ]) {
      expect(isSyncedKey(key)).toBe(true);
    }
  });

  // Сортировок столько же, сколько разделов, и перечислять их поимённо значило бы забыть следующую.
  it('сортировки любых разделов — да, по префиксу', () => {
    expect(isSyncedKey('medassist:sort:patients')).toBe(true);
    expect(isSyncedKey('medassist:sort:чего-нибудь-нового')).toBe(true);
  });

  it('ключ от аккаунта и демо-сессия — никогда', () => {
    expect(isSyncedKey('medassist:auth-token')).toBe(false);
    expect(isSyncedKey('medassist:demo')).toBe(false);
    expect(isSyncedKey('medassist:demo-data')).toBe(false);
  });

  // Общая на устройства, она сделала бы вторую перезагрузку невозможной там, где она и нужна.
  it('отметка о перезагрузке после деплоя — никогда', () => {
    expect(isSyncedKey('medassist:stale-chunk-reload')).toBe(false);
  });

  it('отметка о засеве лент остаётся у браузера', () => {
    expect(isSyncedKey('medassist:news-sources:seeded-defaults-v3')).toBe(false);
  });

  it('чужой ключ не синхронизируется по ошибке', () => {
    expect(isSyncedKey('что-то-постороннее')).toBe(false);
  });
});

describe('потолок значения', () => {
  it('обычная настройка проходит', () => {
    expect(isSyncable('medassist:appearance', JSON.stringify({ preset: 'mint', veil: 0.75 }))).toBe(true);
  });

  // Обои со своей фотографией лежат строкой data: и весят сотни килобайт: это уже не настройка.
  it('тяжёлое значение остаётся на устройстве', () => {
    expect(isSyncable('medassist:appearance', 'x'.repeat(MAX_SYNCED_LENGTH + 1))).toBe(false);
  });

  it('ровно по потолку — ещё проходит', () => {
    expect(isSyncable('medassist:appearance', 'x'.repeat(MAX_SYNCED_LENGTH))).toBe(true);
  });

  it('несинхронизируемый ключ не спасает даже короткое значение', () => {
    expect(isSyncable('medassist:auth-token', 'коротко')).toBe(false);
  });
});
