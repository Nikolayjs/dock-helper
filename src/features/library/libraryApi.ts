/**
 * Hand-written calls for the three `/library` operations that don't fit `createHttpRepository`'s
 * plain-JSON shape: multipart upload, binary file download, and the separate progress endpoint.
 * `list`/metadata-`update`/`remove` still go through the generic repo in useLibrary.ts.
 */
import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from '../newsFeed/backendError';
import { getAuthToken } from '../../lib/tokenStore';
import type { Book, BookProgress } from './types';

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
  /** Отпечаток делает файл общим на сервере: один объект — сколько угодно записей. */
  sha256?: string;
}

/** Запись о книге, файл которой лежит в браузере читателя. */
export interface DeviceBookRecord extends UploadBookMeta {
  format: Book['format'];
  fileName: string;
  fileSize: number;
  sha256: string;
}

/** Запись о книге, которой у нас нет вовсе: есть только адрес первоисточника. */
export interface LinkBookRecord {
  title: string;
  author: string;
  description: string;
  sourceUrl: string;
}

async function postJson(body: unknown, failure: string): Promise<Book> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
  } catch {
    throw new LibraryApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) throw new LibraryApiError(await backendErrorMessage(response, `${failure} (${response.status}).`));
  return (await response.json()) as Book;
}

/**
 * Завести запись о книге, не отправляя файл.
 *
 * Это и есть та самая экономия: на сервер уходит обложка и десяток полей, а не двести мегабайт.
 * Порядок вызова важен — файл кладётся на устройство **до** записи, иначе отказавшее хранилище
 * оставит на полке книгу, которую нечем открыть.
 */
export function createDeviceBook(record: DeviceBookRecord): Promise<Book> {
  return postJson({ storage: 'device', ...record, coverDataUrl: record.coverDataUrl ?? undefined, pageCount: record.pageCount ?? undefined }, 'Не удалось добавить книгу');
}

export function createLinkBook(record: LinkBookRecord): Promise<Book> {
  return postJson({ storage: 'link', ...record }, 'Не удалось добавить книгу по ссылке');
}

/**
 * Убрать байты с сервера, оставив запись: книга переехала на устройство.
 *
 * Отпечаток едет этим же запросом — по нему браузер потом узнаёт свой файл.
 */
export async function dropServerFile(id: string, sha256: string): Promise<Book> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/library/${id}/file`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ sha256 }),
    });
  } catch {
    throw new LibraryApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) throw new LibraryApiError(await backendErrorMessage(response, `Не удалось освободить место на сервере (${response.status}).`));
  return (await response.json()) as Book;
}

export async function uploadBook(file: File, meta: UploadBookMeta): Promise<Book> {
  const form = new FormData();
  form.append('file', file);
  if (meta.title) form.append('title', meta.title);
  if (meta.author) form.append('author', meta.author);
  if (meta.description) form.append('description', meta.description);
  if (meta.coverDataUrl) form.append('coverDataUrl', meta.coverDataUrl);
  if (meta.pageCount != null) form.append('pageCount', String(meta.pageCount));
  if (meta.sha256) form.append('sha256', meta.sha256);

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

/**
 * Ответ ручки прогресса: нас интересуют только эти два поля.
 *
 * Сервер отдаёт запись **без обложки** — ради вкладок, открытых до деплоя (см. `updateProgress` в
 * `library.service.ts`); всё остальное здесь сознательно не читается: в кэш идёт только прогресс.
 */
export interface BookProgressUpdate {
  id: string;
  progress: BookProgress;
}

export async function updateBookProgress(id: string, location: number): Promise<BookProgressUpdate> {
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
  return (await response.json()) as BookProgressUpdate;
}

/**
 * Последняя отправка позиции — при уходе со страницы.
 *
 * `keepalive` доживает запрос после того, как вкладку закрыли, — ровно то, ради чего существует
 * `sendBeacon`. Взят он, а не маяк, по одной причине: **маяк не умеет заголовков**, а наш API
 * закрыт `Authorization: Bearer`. С маяком пришлось бы возить токен в теле и открывать ручку
 * наружу — дороже, чем стоит само сохранение позиции.
 */
export function sendFinalProgress(id: string, location: number): void {
  try {
    void fetch(`${API_BASE_URL}/library/${id}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ location }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Позиция уже записана на устройстве: не доехала — не потерялась.
  }
}
