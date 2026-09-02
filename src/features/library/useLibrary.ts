import { useLayoutEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import * as bookFiles from './bookFiles';
import { sha256Of } from './bookSource';
import { decodeFb2Text, parseFb2 } from './fb2';
import { findByFingerprint, fileStillUsed } from './shelf';
import { createDeviceBook, createLinkBook, dropServerFile, fetchBookFile, updateBookProgress, uploadBook } from './libraryApi';
import { readDocx } from '../../lib/docx/readDocx';
import { LEGACY_DOC_MESSAGE } from '../../lib/docx/wordFormat';
import type { Book, BookFormat, BookMetaInput } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['library-books'];
const resource = createCrudResource<Book, never, BookMetaInput>('/library', QUERY_KEY);

function detectFormat(fileName: string): BookFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' || ext === 'fb2' || ext === 'docx') return ext;
  if (ext === 'djvu' || ext === 'djv') return 'djvu';
  return null;
}

interface ParsedBookMeta {
  title: string;
  author: string;
  description: string;
  coverDataUrl: string | null;
  pageCount: number | null;
  /** Отпечаток считается здесь же: файл в этот момент уже прочитан в память ради метаданных. */
  sha256: string;
}

async function readBookMeta(file: File, format: BookFormat): Promise<ParsedBookMeta> {
  const fallbackTitle = file.name.replace(/\.(pdf|docx|fb2|djvu|djv)$/i, '');
  const buffer = await file.arrayBuffer();
  const sha256 = await sha256Of(buffer);

  if (format === 'docx') {
    // Word records a title only when someone filled it in, which is rare — the filename is usually
    // the honest answer, so it wins unless the document actually carries one.
    const parsed = await readDocx(new Uint8Array(buffer));
    return {
      title: parsed.title || fallbackTitle,
      author: parsed.author,
      description: '',
      coverDataUrl: parsed.coverDataUrl,
      pageCount: null,
      sha256,
    };
  }

  if (format === 'fb2') {
    const parsed = parseFb2(decodeFb2Text(buffer));
    return {
      title: parsed.title || fallbackTitle,
      author: parsed.author,
      description: parsed.description,
      coverDataUrl: parsed.coverDataUrl,
      pageCount: null,
      sha256,
    };
  }

  if (format === 'djvu') {
    // Разборщики PDF и DjVu подключаются здесь, а не сверху файла, и это не стиль, а вес: pdf.js
    // — 94 КБ gzip, и статический импорт тянул его в каждый экран, который спрашивает список книг.
    // Полка начатых книг стоит на дашборде, то есть pdf.js грузился при каждом входе в приложение,
    // тогда как нужен он ровно в одну секунду — когда врач загружает книгу.
    const { extractDjvuMeta } = await import('./djvuMeta');
    const meta = await extractDjvuMeta(buffer);
    return {
      title: fallbackTitle,
      author: '',
      description: '',
      coverDataUrl: meta.coverDataUrl,
      pageCount: meta.pageCount,
      sha256,
    };
  }

  const { extractPdfMeta } = await import('./pdfMeta');
  const meta = await extractPdfMeta(buffer);
  return {
    title: meta.title || fallbackTitle,
    author: meta.author,
    description: '',
    coverDataUrl: meta.coverDataUrl,
    pageCount: meta.pageCount,
    sha256,
  };
}

/** Что вернуло добавление: новая книга или уже стоявшая на полке с тем же содержимым. */
export interface AddBookResult {
  book: Book;
  /** Файл с таким отпечатком уже был: второй записи не завели, открываем существующую. */
  duplicate: boolean;
}

export function useLibrary() {
  const { items: books, isLoading, error, refetch, invalidate, update, remove, replaceInCache } =
    useCrudResource(resource);
  const booksRef = useRef(books);
  useLayoutEffect(() => {
    booksRef.current = books;
  });

  // Загрузка книги остаётся своей мутацией: кнопке нужен `isPending`, а разбор файла идёт на
  // фронте и до отправки может честно отказать — по расширению и по сигнатуре `.doc`.
  const addBookMutation = useMutation({
    mutationFn: async ({ file, cloud }: { file: File; cloud?: boolean }): Promise<AddBookResult> => {
      if (file.name.split('.').pop()?.toLowerCase() === 'doc') throw new Error(LEGACY_DOC_MESSAGE);
      const format = detectFormat(file.name);
      if (!format) throw new Error('Поддерживаются только файлы PDF, DOCX, FB2 и DjVu');

      const meta = await readBookMeta(file, format);

      // Тот же файл уже на полке — открываем её, а не заводим вторую запись. Отпечаток отвечает на
      // это точно, в отличие от имени файла: «Учебник (1).pdf» — та же книга, `book.pdf` соседа —
      // другая.
      const existing = findByFingerprint(booksRef.current, meta.sha256);
      if (existing) {
        // Файла может не быть здесь — книгу добавляли с другого устройства. Раз он в руках, кладём.
        if (existing.storage === 'device' && !(await bookFiles.hasFile(meta.sha256))) {
          await bookFiles.putFile(meta.sha256, file);
        }
        return { book: existing, duplicate: true };
      }

      if (cloud) return { book: await uploadBook(file, meta), duplicate: false };

      // Сперва файл на устройство, потом запись. Обратный порядок оставляет на полке книгу,
      // которую нечем открыть, — а хранилище отказывает чаще, чем кажется.
      await bookFiles.putFile(meta.sha256, file);
      const book = await createDeviceBook({ ...meta, format, fileName: file.name, fileSize: file.size });
      return { book, duplicate: false };
    },
    onSuccess: invalidate,
  });

  const addLinkMutation = useMutation({
    mutationFn: (record: { title: string; author: string; description: string; sourceUrl: string }) => createLinkBook(record),
    onSuccess: invalidate,
  });

  /**
   * Перенести книгу из облака на устройство: скачать один раз, положить, освободить место.
   *
   * Молча и автоматически этого не делает никто: на мобильном интернете это чужой трафик.
   */
  const moveToDeviceMutation = useMutation({
    mutationFn: async (book: Book) => {
      const blob = await fetchBookFile(book.id);
      if (!blob) throw new Error('Файл этой книги на сервере не найден');
      const sha256 = await sha256Of(await blob.arrayBuffer());
      await bookFiles.putFile(sha256, blob);
      return dropServerFile(book.id, sha256);
    },
    onSuccess: replaceInCache,
  });

  // Место в книге сохраняется на каждой прокрутке: перезагружать ради него весь список нельзя.
  const updateProgressMutation = useMutation({
    mutationFn: ({ id, location }: { id: string; location: number }) => updateBookProgress(id, location),
    onSuccess: replaceInCache,
  });

  /**
   * Удаление книги уносит и локальный файл — но только если на него не ссылается вторая запись.
   *
   * Файл общий: две записи с одним отпечатком делят его, и удаление своей копии не должно оставить
   * соседнюю книгу без содержимого.
   *
   * Принимается **книга целиком, а не идентификатор**, и это исправленная ошибка: удаление идёт
   * через общее окно с отменой, а оно прячет строку из кэша сразу — к моменту, когда дело доходит
   * до файла, найти книгу в списке уже нельзя, и файл оставался на устройстве навсегда. Поймано
   * прогоном: запись на сервере удалена, файл в OPFS на месте.
   */
  const deleteBook = async (book: Book) => {
    await remove(book.id);
    if (!book.sha256) return;
    if (!fileStillUsed(booksRef.current, book.id, book.sha256)) {
      await bookFiles.deleteFile(book.sha256).catch(() => undefined);
    }
  };

  return {
    books,
    isLoading,
    error,
    refetch,
    addBook: addBookMutation.mutateAsync,
    isAdding: addBookMutation.isPending,
    addLinkBook: addLinkMutation.mutateAsync,
    isAddingLink: addLinkMutation.isPending,
    moveToDevice: moveToDeviceMutation.mutateAsync,
    isMoving: moveToDeviceMutation.isPending,
    updateMeta: update,
    updateProgress: (id: string, location: number) => updateProgressMutation.mutateAsync({ id, location }),
    deleteBook,
  };
}

export function useBook(id: string | undefined) {
  const library = useLibrary();
  const book = library.books.find((b) => b.id === id);
  return { ...library, book };
}

export { getBookBlob, BookFileMissingError, BookIsLinkError } from './bookSource';
