import { getFile, hasFile, putFile } from './bookFiles';
import { fetchBookFile } from './libraryApi';
import type { Book } from './types';

/**
 * Откуда взять байты книги — и почему это отдельный файл, а не строка в читалке.
 *
 * Читалка целиком клиентская и принимает `Blob`; ей всё равно, пришёл он с диска, из сети или не
 * пришёл вовсе. Поэтому точка подмены ровно одна, и она здесь: `device` → хранилище браузера,
 * `server` → облачная полка, `link` → читать нечего.
 */

/**
 * Книга есть на полке, но её файла нет **на этом устройстве**.
 *
 * Это не ошибка, а нормальное положение вещей: читатель добавил книгу с рабочего компьютера и
 * открыл полку с телефона. Отдельный класс нужен ровно затем, чтобы интерфейс отличил этот случай
 * от «не удалось открыть файл» и предложил добавить файл, а не показал красную плашку.
 */
export class BookFileMissingError extends Error {
  constructor() {
    super('Файл этой книги лежит на другом устройстве');
  }
}

export class BookIsLinkError extends Error {
  constructor() {
    super('Эта книга открывается по ссылке на первоисточник');
  }
}

export async function getBookBlob(book: Book): Promise<Blob> {
  if (book.storage === 'link') throw new BookIsLinkError();

  if (book.storage === 'device') {
    if (!book.sha256) throw new BookFileMissingError();
    const file = await getFile(book.sha256);
    if (!file) throw new BookFileMissingError();
    return file;
  }

  const blob = await fetchBookFile(book.id);
  if (!blob) throw new BookFileMissingError();
  // Облачная книга кладётся в хранилище браузера кэшем по отпечатку: второе открытие не стоит
  // трафика вовсе. Кэш живёт здесь, а не в Cache API, потому что ключ — содержимое, а не адрес:
  // две записи с одним файлом делят его, и чистится он вместе с книгой.
  if (book.sha256 && !(await hasFile(book.sha256))) {
    try {
      await putFile(book.sha256, blob);
    } catch {
      // Кэш — ускорение, а не условие: не поместилось, значит в следующий раз снова из сети.
    }
  }
  return blob;
}

/**
 * Отпечаток файла — тот же, что считает сервер и под которым книга лежит на устройстве.
 *
 * Считается в браузере: `crypto.subtle` есть везде, где есть https, а книга и так прочитана в
 * память ради разбора метаданных.
 */
export async function sha256Of(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
