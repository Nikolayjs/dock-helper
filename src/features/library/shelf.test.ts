import { describe, expect, it } from 'vitest';

import { fileStillUsed, findByFingerprint } from './shelf';
import type { Book } from './types';

function book(id: string, sha256: string | null, patch: Partial<Book> = {}): Book {
  return {
    id,
    format: 'pdf',
    storage: 'device',
    sha256,
    sourceUrl: null,
    title: `Книга ${id}`,
    author: '',
    description: '',
    coverDataUrl: null,
    fileName: `${id}.pdf`,
    fileSize: 1,
    pageCount: null,
    progress: null,
    addedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  };
}

describe('полка и общий файл', () => {
  const sha = 'e'.repeat(64);

  it('тот же файл узнаётся по отпечатку, а не по имени', () => {
    const shelf = [book('a', sha, { fileName: 'Учебник.pdf' })];
    expect(findByFingerprint(shelf, sha)?.id).toBe('a');
  });

  it('другой файл дублем не считается', () => {
    expect(findByFingerprint([book('a', sha)], 'f'.repeat(64))).toBeUndefined();
  });

  it('книги без отпечатка ничему не равны — иначе старые загрузки слиплись бы в одну', () => {
    expect(findByFingerprint([book('a', null), book('b', null)], '')).toBeUndefined();
  });

  it('файл, на который ссылается вторая запись, при удалении первой остаётся', () => {
    const shelf = [book('a', sha), book('b', sha)];
    expect(fileStillUsed(shelf, 'a', sha)).toBe(true);
  });

  it('последняя запись уносит файл с собой', () => {
    expect(fileStillUsed([book('a', sha), book('b', 'f'.repeat(64))], 'a', sha)).toBe(false);
  });
});
