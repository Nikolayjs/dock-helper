import { useMutation } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { decodeFb2Text, parseFb2 } from './fb2';
import { fetchBookFile, updateBookProgress, uploadBook } from './libraryApi';
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
}

async function readBookMeta(file: File, format: BookFormat): Promise<ParsedBookMeta> {
  const fallbackTitle = file.name.replace(/\.(pdf|docx|fb2|djvu|djv)$/i, '');
  const buffer = await file.arrayBuffer();

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
  };
}

export function useLibrary() {
  const { items: books, isLoading, error, refetch, invalidate, update, remove, replaceInCache } =
    useCrudResource(resource);

  // Загрузка книги остаётся своей мутацией: кнопке нужен `isPending`, а разбор файла идёт на
  // фронте и до отправки может честно отказать — по расширению и по сигнатуре `.doc`.
  const addBookMutation = useMutation({
    mutationFn: async (file: File) => {
      if (file.name.split('.').pop()?.toLowerCase() === 'doc') throw new Error(LEGACY_DOC_MESSAGE);
      const format = detectFormat(file.name);
      if (!format) throw new Error('Поддерживаются только файлы PDF, DOCX, FB2 и DjVu');

      const meta = await readBookMeta(file, format);
      return uploadBook(file, meta);
    },
    onSuccess: invalidate,
  });

  // Место в книге сохраняется на каждой прокрутке: перезагружать ради него весь список нельзя.
  const updateProgressMutation = useMutation({
    mutationFn: ({ id, location }: { id: string; location: number }) => updateBookProgress(id, location),
    onSuccess: replaceInCache,
  });

  return {
    books,
    isLoading,
    error,
    refetch,
    addBook: addBookMutation.mutateAsync,
    isAdding: addBookMutation.isPending,
    updateMeta: update,
    updateProgress: (id: string, location: number) => updateProgressMutation.mutateAsync({ id, location }),
    deleteBook: remove,
  };
}

export function useBook(id: string | undefined) {
  const library = useLibrary();
  const book = library.books.find((b) => b.id === id);
  return { ...library, book };
}

export { fetchBookFile as loadBookFile };
