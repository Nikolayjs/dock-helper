import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { backendKind, BookStorageError, deleteFile, getFile, hasFile, putFile, resetBackendForTests, usage } from './bookFiles';

/**
 * Проверяется **запасная ветка на IndexedDB**: OPFS в jsdom нет вовсе, а именно эта ветка достаётся
 * старым Safari и части приватных окон, то есть тем, у кого книги ломались бы молча.
 *
 * OPFS проверен руками в Chrome — файл на 200 МБ пишется и читается, `usage()` показывает
 * осмысленные числа; автоматизировать это нечем: `navigator.storage.getDirectory` в jsdom не
 * существует.
 */
describe('файлы книг на устройстве (IndexedDB)', () => {
  const sha = 'a'.repeat(64);

  /** В jsdom `navigator.storage` нет вовсе — подставляем ровно то, чем пользуется модуль. */
  function stubStorage(estimate: { usage: number; quota: number }) {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => estimate, persist: async () => true },
    });
  }

  beforeEach(async () => {
    resetBackendForTests();
    await deleteFile(sha);
    Reflect.deleteProperty(navigator, 'storage');
  });

  it('выбирает IndexedDB, когда OPFS недоступен', async () => {
    expect(await backendKind()).toBe('indexeddb');
  });

  it('записывает, читает и удаляет файл по отпечатку', async () => {
    await putFile(sha, new Blob(['%PDF-1.4 книга'], { type: 'application/pdf' }));

    expect(await hasFile(sha)).toBe(true);
    const back = await getFile(sha);
    expect(await back?.text()).toBe('%PDF-1.4 книга');

    await deleteFile(sha);
    expect(await hasFile(sha)).toBe(false);
    expect(await getFile(sha)).toBeUndefined();
  });

  it('отсутствующий файл — это `undefined`, а не отказ', async () => {
    expect(await getFile('b'.repeat(64))).toBeUndefined();
    expect(await hasFile('b'.repeat(64))).toBe(false);
  });

  it('удаление того, чего нет, проходит молча', async () => {
    await expect(deleteFile('c'.repeat(64))).resolves.toBeUndefined();
  });

  it('две записи одной книги делят один файл: повторная запись не плодит копий', async () => {
    await putFile(sha, new Blob(['первая']));
    await putFile(sha, new Blob(['вторая']));
    expect(await (await getFile(sha))?.text()).toBe('вторая');
  });

  it('отказавшее хранилище — это `BookStorageError` с человеческим текстом, а не падение', async () => {
    const open = indexedDB.open;
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('нет доступа к данным сайта', 'SecurityError');
    });

    await expect(putFile(sha, new Blob(['x']))).rejects.toBeInstanceOf(BookStorageError);
    await expect(putFile(sha, new Blob(['x']))).rejects.toThrow(/Не удалось сохранить книгу/);

    vi.mocked(indexedDB.open).mockRestore();
    expect(indexedDB.open).toBe(open);
  });

  it('наличие файла при отказавшем хранилище — «нет», а не исключение', async () => {
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('нет доступа', 'SecurityError');
    });
    // Наличие спрашивают на каждой карточке полки: отказ обязан читаться как «файла здесь нет».
    expect(await hasFile(sha)).toBe(false);
    vi.mocked(indexedDB.open).mockRestore();
  });

  it('занятое место отдаётся нулями, когда браузер не умеет считать', async () => {
    expect(await usage()).toEqual({ used: 0, quota: 0 });
  });

  it('книга, которая не влезает, отвергается **до** записи и с числами', async () => {
    // Обрыв на середине двухсотмегабайтного файла оставляет огрызок и невнятную ошибку; отказ
    // заранее говорит, сколько нужно и сколько есть.
    stubStorage({ usage: 900 * 1024 * 1024, quota: 1000 * 1024 * 1024 });

    await expect(putFile(sha, new Blob([new Uint8Array(200 * 1024 * 1024)]))).rejects.toThrow(
      /Книга занимает 200 МБ, а на устройстве свободно 100 МБ/,
    );
    expect(await hasFile(sha)).toBe(false);
  });

  it('книга, которая влезает, пишется', async () => {
    stubStorage({ usage: 10 * 1024 * 1024, quota: 1000 * 1024 * 1024 });
    await putFile(sha, new Blob(['книга']));
    expect(await hasFile(sha)).toBe(true);
  });

  it('браузер, не сказавший про место, записи не мешает', async () => {
    // «Не знаю» — не то же самое, что «не влезет»: узнаем по факту записи, как и раньше.
    stubStorage({ usage: 0, quota: 0 });
    await putFile(sha, new Blob(['книга']));
    expect(await hasFile(sha)).toBe(true);
  });
});
