import { describe, expect, it } from 'vitest';

import { RELOAD_COOLDOWN_MS, shouldReload } from './staleChunkReload';

describe('shouldReload', () => {
  it('перезагружается, когда отметки нет: вкладка пережила деплой', () => {
    expect(shouldReload(1_000_000, null)).toBe(true);
  });

  it('второй раз подряд не перезагружается — иначе цикл вместо честной ошибки', () => {
    expect(shouldReload(1_000_000, String(1_000_000 - 1000))).toBe(false);
  });

  it('через время отметка перестаёт мешать: это уже другой деплой', () => {
    expect(shouldReload(1_000_000, String(1_000_000 - RELOAD_COOLDOWN_MS - 1))).toBe(true);
  });

  it('испорченная отметка не запрещает перезагрузку навсегда', () => {
    expect(shouldReload(1_000_000, 'позавчера')).toBe(true);
  });
});
