export type BookFormat = 'pdf' | 'fb2' | 'djvu' | 'docx';

export interface BookProgress {
  /** PDF/DjVu: 1-based current page. FB2/DOCX: scroll fraction from 0 to 1. */
  location: number;
  updatedAt: string;
}

/**
 * Где лежат байты книги.
 *
 * `device` — в браузере читателя, под именем `sha256`; `server` — в облачной полке; `link` — нигде,
 * есть только адрес первоисточника. Поля «на каком устройстве» нет и не будет: наличие книги здесь
 * и сейчас — это `hasFile(sha256)` локально, см. `bookFiles.ts`.
 */
export type BookStorage = 'device' | 'server' | 'link';

export interface Book {
  id: string;
  format: BookFormat;
  storage: BookStorage;
  /** Отпечаток файла: им же он назван в хранилище браузера. Пусто у книг по ссылке и у старых загрузок. */
  sha256: string | null;
  sourceUrl: string | null;
  title: string;
  author: string;
  description: string;
  coverDataUrl: string | null;
  fileName: string;
  fileSize: number;
  pageCount: number | null;
  progress: BookProgress | null;
  addedAt: string;
  updatedAt: string;
}

export type BookMetaInput = Pick<Book, 'title' | 'author' | 'description'>;
