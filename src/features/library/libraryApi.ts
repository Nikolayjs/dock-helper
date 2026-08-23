/**
 * Hand-written calls for the three `/library` operations that don't fit `createHttpRepository`'s
 * plain-JSON shape: multipart upload, binary file download, and the separate progress endpoint.
 * `list`/metadata-`update`/`remove` still go through the generic repo in useLibrary.ts.
 */
import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from '../newsFeed/backendError';
import { getAuthToken } from '../../lib/tokenStore';
import type { Book } from './types';

export class LibraryApiError extends Error {}

function authHeaders(): HeadersInit | undefined {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export interface UploadBookMeta {
  title: string;
  author: string;
  description: string;
  coverDataUrl: string | null;
  pageCount: number | null;
}

export async function uploadBook(file: File, meta: UploadBookMeta): Promise<Book> {
  const form = new FormData();
  form.append('file', file);
  if (meta.title) form.append('title', meta.title);
  if (meta.author) form.append('author', meta.author);
  if (meta.description) form.append('description', meta.description);
  if (meta.coverDataUrl) form.append('coverDataUrl', meta.coverDataUrl);
  if (meta.pageCount != null) form.append('pageCount', String(meta.pageCount));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/library`, { method: 'POST', headers: authHeaders(), body: form });
  } catch {
    throw new LibraryApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) throw new LibraryApiError(await backendErrorMessage(response, `Не удалось загрузить книгу (${response.status}).`));
  return (await response.json()) as Book;
}

export async function fetchBookFile(id: string): Promise<Blob | undefined> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/library/${id}/file`, { headers: authHeaders() });
  } catch {
    throw new LibraryApiError('Не удалось подключиться к серверу.');
  }
  if (response.status === 404) return undefined;
  if (!response.ok) throw new LibraryApiError(await backendErrorMessage(response, `Не удалось загрузить файл (${response.status}).`));
  return response.blob();
}

export async function updateBookProgress(id: string, location: number): Promise<Book> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/library/${id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ location }),
    });
  } catch {
    throw new LibraryApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) throw new LibraryApiError(await backendErrorMessage(response, `Не удалось сохранить прогресс (${response.status}).`));
  return (await response.json()) as Book;
}
