import type { Book, BookProgress } from './types';

/**
 * Место в книге: сначала на устройстве, на сервер — редко.
 *
 * До этого читалка слала позицию на сервер каждые 0,8 секунды, а ответ возвращал **всю книгу**,
 * включая обложку строкой `data:`. Час чтения — сотни запросов, и в каждом ответе ехала картинка
 * ради одного изменившегося числа.
 *
 * Теперь позиция пишется в `localStorage` сразу (это ноль сети и ноль ожидания), а на сервер уходит
 * раз в двенадцать секунд и обязательно при уходе со страницы. Сервер по-прежнему нужен: он
 * единственный, кто расскажет о месте в книге другому устройству.
 */

const PREFIX = 'medassist:reading-position:';

/** Раз в столько миллисекунд позиция уезжает на сервер во время чтения. */
export const SERVER_SAVE_INTERVAL_MS = 12_000;

interface StoredPosition {
  location: number;
  updatedAt: string;
}

export function saveLocalPosition(bookId: string, location: number): void {
  try {
    const value: StoredPosition = { location, updatedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + bookId, JSON.stringify(value));
  } catch {
    // Приватное окно и запрет на данные сайта: позиция просто уедет на сервер, как раньше.
  }
}

export function readLocalPosition(bookId: string): StoredPosition | null {
  try {
    const raw = localStorage.getItem(PREFIX + bookId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPosition>;
    if (typeof parsed.location !== 'number' || typeof parsed.updatedAt !== 'string') return null;
    return { location: parsed.location, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

export function forgetLocalPosition(bookId: string): void {
  try {
    localStorage.removeItem(PREFIX + bookId);
  } catch {
    /* нечего забывать */
  }
}

/**
 * Где читатель на самом деле остановился.
 *
 * Побеждает более позднее из двух: местное — потому что до сервера оно могло не доехать (вкладку
 * закрыли, сеть отвалилась); серверное — потому что читать могли с другого устройства. Сравниваются
 * времена, а не источники: у «последней записи выигрывает» здесь нет разумной альтернативы, а
 * слияние двух мест в книге не значит ничего.
 */
export function latestProgress(book: Book): BookProgress | null {
  const local = readLocalPosition(book.id);
  if (!local) return book.progress;
  if (!book.progress) return local;
  return local.updatedAt > book.progress.updatedAt ? local : book.progress;
}
