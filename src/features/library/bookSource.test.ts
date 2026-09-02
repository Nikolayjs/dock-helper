import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteFile, putFile, resetBackendForTests } from './bookFiles';
import type { Book } from './types';

const fetchBookFile = vi.hoisted(() => vi.fn());
vi.mock('./libraryApi', () => ({ fetchBookFile }));

const { BookFileMissingError, BookIsLinkError, getBookBlob, sha256Of } = await import('./bookSource');

function book(patch: Partial<Book>): Book {
  return {
    id: 'b1',
    format: 'pdf',
    storage: 'device',
    sha256: null,
    sourceUrl: null,
    title: 'Книга',
    author: '',
    description: '',
    coverDataUrl: null,
    fileName: 'book.pdf',
    fileSize: 10,
    pageCount: null,
    progress: null,
    addedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  };
}

describe('откуда берутся байты книги', () => {
  const sha = 'd'.repeat(64);

  beforeEach(async () => {
    resetBackendForTests();
    fetchBookFile.mockReset();
    await deleteFile(sha);
  });

  it('книга на устройстве читается с устройства, а не из сети', async () => {
    await putFile(sha, new Blob(['с диска']));
    const blob = await getBookBlob(book({ storage: 'device', sha256: sha }));

    expect(await blob.text()).toBe('с диска');
    expect(fetchBookFile).not.toHaveBeenCalled();
  });

  it('книга на устройстве без файла — это `BookFileMissingError`, а не общая ошибка', async () => {
    // Интерфейс отличает этот случай по типу: у него есть что предложить — выбрать тот же файл.
    await expect(getBookBlob(book({ storage: 'device', sha256: sha }))).rejects.toBeInstanceOf(BookFileMissingError);
  });

  it('запись без отпечатка тоже считается книгой без файла', async () => {
    await expect(getBookBlob(book({ storage: 'device', sha256: null }))).rejects.toBeInstanceOf(BookFileMissingError);
  });

  it('облачная книга скачивается и кладётся в кэш по отпечатку', async () => {
    fetchBookFile.mockResolvedValue(new Blob(['из облака']));
    const cloud = book({ storage: 'server', sha256: sha });

    expect(await (await getBookBlob(cloud)).text()).toBe('из облака');
    expect(fetchBookFile).toHaveBeenCalledTimes(1);

    // Второе открытие не стоит трафика: файл уже на устройстве.
    fetchBookFile.mockResolvedValue(new Blob(['из облака второй раз']));
    expect(await (await getBookBlob(book({ storage: 'device', sha256: sha }))).text()).toBe('из облака');
  });

  it('облачная книга, которой нет на сервере, — тоже отсутствующий файл', async () => {
    fetchBookFile.mockResolvedValue(undefined);
    await expect(getBookBlob(book({ storage: 'server' }))).rejects.toBeInstanceOf(BookFileMissingError);
  });

  it('книгу по ссылке читать нечем, и она говорит об этом своим типом ошибки', async () => {
    await expect(getBookBlob(book({ storage: 'link', sourceUrl: 'https://example.org' }))).rejects.toBeInstanceOf(
      BookIsLinkError,
    );
    expect(fetchBookFile).not.toHaveBeenCalled();
  });

  it('отпечаток совпадает с тем, что считает сервер', async () => {
    // Известный вектор: SHA-256 от пустого ввода.
    expect(await sha256Of(new ArrayBuffer(0))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
