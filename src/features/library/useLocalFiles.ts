import { useEffect, useState, useSyncExternalStore } from 'react';

import { hasFile, subscribeToFiles, usage, type StorageUsage } from './bookFiles';
import type { Book } from './types';

/**
 * Какие книги лежат **на этом устройстве**.
 *
 * Спрашивается у хранилища, а не у сервера, и это то самое несущее решение: поля «на каком
 * устройстве файл» в базе нет и не будет. Ответ — множество отпечатков, потому что две записи с
 * одним содержимым делят один файл, и спрашивать про каждую запись отдельно значило бы спрашивать
 * дважды об одном.
 */
export function useLocalFiles(books: Book[]): { present: Set<string>; ready: boolean } {
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  // Записанный или удалённый файл меняет ответ, а список книг при этом остаётся прежним: книгу
  // перенесли на устройство, `sha256` у неё тот же — пересчитать заставляет только это.
  const revision = useFilesRevision();
  // Ключ — список отпечатков, а не сам массив: список книг пересоздаётся на каждый рендер, а
  // спрашивать хранилище на каждый рендер незачем.
  const fingerprints = books
    .map((book) => book.sha256)
    .filter((sha): sha is string => Boolean(sha))
    .sort()
    .join(',');

  useEffect(() => {
    let cancelled = false;
    const list = fingerprints ? fingerprints.split(',') : [];
    void Promise.all(list.map(async (sha) => ((await hasFile(sha)) ? sha : null))).then((found) => {
      if (cancelled) return;
      setPresent(new Set(found.filter((sha): sha is string => sha !== null)));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fingerprints, revision]);

  return { present, ready };
}

/**
 * Сколько раз хранилище менялось. Значение само по себе ничего не значит — важно, что оно другое.
 */
function useFilesRevision(): number {
  return useSyncExternalStore(
    (onChange) => subscribeToFiles(onChange),
    () => revisionCounter,
    () => 0,
  );
}

let revisionCounter = 0;
subscribeToFiles(() => {
  revisionCounter += 1;
});

/** Занятое место, как его считает браузер. Числа приблизительные — он округляет их нарочно. */
export function useStorageUsage(refreshKey?: unknown): StorageUsage | null {
  const [value, setValue] = useState<StorageUsage | null>(null);
  useEffect(() => {
    let cancelled = false;
    void usage().then((next) => {
      if (!cancelled) setValue(next);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);
  return value;
}

/** Что показывать про книгу на карточке и в шапке. */
export type BookLocation = 'here' | 'elsewhere' | 'cloud' | 'link';

export function bookLocation(book: Book, present: Set<string>): BookLocation {
  if (book.storage === 'link') return 'link';
  if (book.storage === 'server') return 'cloud';
  return book.sha256 && present.has(book.sha256) ? 'here' : 'elsewhere';
}

export const LOCATION_LABEL: Record<BookLocation, string> = {
  here: 'На этом устройстве',
  elsewhere: 'Файла нет на этом устройстве',
  cloud: 'В облаке',
  link: 'По ссылке',
};
