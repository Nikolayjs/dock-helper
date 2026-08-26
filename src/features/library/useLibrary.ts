import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import { extractDjvuMeta } from './djvuMeta';
import { decodeFb2Text, parseFb2 } from './fb2';
import { fetchBookFile, updateBookProgress, uploadBook } from './libraryApi';
import { extractPdfMeta } from './pdfMeta';
import { readDocx } from '../../lib/docx/readDocx';
import { LEGACY_DOC_MESSAGE } from '../../lib/docx/wordFormat';
import type { Book, BookFormat, BookMetaInput } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['library-books'];
const repo = createHttpRepository<Book, never, BookMetaInput>('/library');

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
    const meta = await extractDjvuMeta(buffer);
    return {
      title: fallbackTitle,
      author: '',
      description: '',
      coverDataUrl: meta.coverDataUrl,
      pageCount: meta.pageCount,
    };
  }

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
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

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

  const updateMetaMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: BookMetaInput }) => repo.update(id, input),
    onSuccess: invalidate,
  });

  const updateProgressMutation = useMutation({
    mutationFn: ({ id, location }: { id: string; location: number }) => updateBookProgress(id, location),
    onSuccess: (updated) => {
      queryClient.setQueryData<Book[]>(QUERY_KEY, (prev) => prev?.map((b) => (b.id === updated.id ? updated : b)) ?? prev);
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    books: useMemo(() => query.data ?? [], [query.data]),
    isLoading: query.isLoading,
    addBook: addBookMutation.mutateAsync,
    isAdding: addBookMutation.isPending,
    updateMeta: (id: string, input: BookMetaInput) => updateMetaMutation.mutateAsync({ id, input }),
    updateProgress: (id: string, location: number) => updateProgressMutation.mutateAsync({ id, location }),
    deleteBook: deleteBookMutation.mutateAsync,
  };
}

export function useBook(id: string | undefined) {
  const library = useLibrary();
  const book = library.books.find((b) => b.id === id);
  return { ...library, book };
}

export { fetchBookFile as loadBookFile };
