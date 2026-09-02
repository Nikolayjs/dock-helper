/**
 * Файлы книг на этом устройстве.
 *
 * Книга весит сотни мегабайт, а сервер отдавал её **целиком блобом при каждом открытии**: один
 * учебник на 200 МБ, сто читателей, двадцать открытий — 400 ГБ трафика с одной книги. Поэтому
 * сервер хранит полку (название, обложку, прогресс и отпечаток), а байты живут здесь.
 *
 * **Имя файла — это `sha256`, и на этом держится всё остальное.** Сервер не знает, на каком
 * устройстве лежит файл, и знать не должен: наличие книги здесь и сейчас — это `has(sha256)`
 * локально. Отсюда бесплатно получаются три вещи: никакого реестра устройств; две записи одной
 * книги делят один файл; на новом устройстве читатель добавляет тот же файл, отпечаток совпадает —
 * и книга подхватывает прогресс и заметки, ничего не дублируя.
 *
 * Хранилищ два. Основное — OPFS: пишет потоком, не держа книгу в памяти целиком. Запасное —
 * IndexedDB: OPFS нет в старых Safari и в части приватных окон. Выбор делается один раз, при
 * первом обращении.
 */

export interface StorageUsage {
  used: number;
  quota: number;
}

/**
 * Хранилище отказало целиком.
 *
 * Это не редкость: приватное окно, запрет на данные сайта, кончившееся место. Отказ обязан
 * доезжать до интерфейса словами «сохранить не удалось, вот почему», а не падать где-то внутри.
 */
export class BookStorageError extends Error {}

interface FilesBackend {
  readonly kind: 'opfs' | 'indexeddb';
  put(sha256: string, blob: Blob): Promise<void>;
  get(sha256: string): Promise<Blob | undefined>;
  has(sha256: string): Promise<boolean>;
  delete(sha256: string): Promise<void>;
}

const DIRECTORY = 'books';
const DB_NAME = 'medassist-library';
const STORE = 'files';

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function fail(action: string, cause: unknown): never {
  const detail = cause instanceof Error && cause.name === 'QuotaExceededError' ? 'на устройстве не осталось места' : null;
  throw new BookStorageError(detail ? `${action}: ${detail}.` : `${action}.`);
}

/* ------------------------------------------------------------------ OPFS */

function opfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage?.getDirectory === 'function' &&
    typeof FileSystemFileHandle !== 'undefined' &&
    // Писать можно двумя способами, и хватает любого: обычным потоком либо синхронной ручкой из
    // воркера. Второй — единственный путь в Safari до 17: там OPFS есть, а `createWritable` нет.
    ('createWritable' in FileSystemFileHandle.prototype || 'createSyncAccessHandle' in FileSystemFileHandle.prototype)
  );
}

function canWriteInPlace(): boolean {
  return typeof FileSystemFileHandle !== 'undefined' && 'createWritable' in FileSystemFileHandle.prototype;
}

/** Запись синхронной ручкой — только из воркера: она блокирует поток, в котором работает. */
function writeThroughWorker(sha256: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./opfsWrite.worker.ts', import.meta.url), { type: 'module' });
    } catch (error) {
      reject(error);
      return;
    }
    worker.onmessage = (event: MessageEvent<{ ok: boolean; message?: string }>) => {
      worker.terminate();
      if (event.data.ok) resolve();
      else reject(new Error(event.data.message ?? 'Не удалось записать файл'));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Не удалось записать файл'));
    };
    worker.postMessage({ directory: DIRECTORY, name: sha256, blob });
  });
}

async function booksDirectory(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIRECTORY, { create });
}

const opfsBackend: FilesBackend = {
  kind: 'opfs',
  async put(sha256, blob) {
    if (!canWriteInPlace()) {
      await writeThroughWorker(sha256, blob);
      return;
    }
    const dir = await booksDirectory(true);
    const handle = await dir.getFileHandle(sha256, { create: true });
    const writable = await handle.createWritable();
    // Потоком, а не `write(blob)`: книга на 200 МБ, взятая в память целиком, роняет вкладку на
    // телефоне ровно тогда, когда её и добавляют.
    await blob.stream().pipeTo(writable);
  },
  async get(sha256) {
    try {
      const dir = await booksDirectory(false);
      return await (await dir.getFileHandle(sha256)).getFile();
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  },
  async has(sha256) {
    try {
      const dir = await booksDirectory(false);
      await dir.getFileHandle(sha256);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  },
  async delete(sha256) {
    try {
      const dir = await booksDirectory(false);
      await dir.removeEntry(sha256);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  },
};

/* ------------------------------------------------------------- IndexedDB */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runRequest<T>(store: 'readonly' | 'readwrite', body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, store);
        const request = body(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.onabort = () => reject(transaction.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

/**
 * В IndexedDB кладётся не `Blob`, а байты с типом.
 *
 * `Blob` в хранилище кладут не все реализации одинаково (старый Safari не клал вовсе, а часть
 * возвращает его уже не блобом), и заметно это стало бы у тех самых читателей, которым запасная
 * ветка и досталась. Байты переживают запись везде.
 */
interface StoredFile {
  type: string;
  data: ArrayBuffer;
}

const idbBackend: FilesBackend = {
  kind: 'indexeddb',
  async put(sha256, blob) {
    const stored: StoredFile = { type: blob.type, data: await blob.arrayBuffer() };
    await runRequest('readwrite', (store) => store.put(stored, sha256));
  },
  get: (sha256) =>
    runRequest<StoredFile | undefined>('readonly', (store) => store.get(sha256)).then((stored) =>
      stored ? new Blob([stored.data], { type: stored.type }) : undefined,
    ),
  // `count`, а не `get`: проверка наличия не должна вытаскивать в память двести мегабайт.
  has: (sha256) => runRequest<number>('readonly', (store) => store.count(sha256)).then((n) => n > 0),
  async delete(sha256) {
    await runRequest('readwrite', (store) => store.delete(sha256));
  },
};

/* ------------------------------------------------------------------ Фасад */

let backendPromise: Promise<FilesBackend> | null = null;

async function backend(): Promise<FilesBackend> {
  if (!backendPromise) {
    backendPromise = (async () => {
      if (opfsAvailable()) {
        try {
          await booksDirectory(true);
          return opfsBackend;
        } catch {
          // Приватное окно и запрет на данные сайта отказывают именно здесь — не на объявлении API,
          // а на первом обращении к нему.
        }
      }
      if (typeof indexedDB === 'undefined') throw new BookStorageError('Браузер не даёт хранить файлы книг на этом устройстве');
      return idbBackend;
    })();
  }
  return backendPromise;
}

/** Какое хранилище выбрано. Нужно проверкам и объяснению в интерфейсе, больше ничему. */
export async function backendKind(): Promise<FilesBackend['kind']> {
  return (await backend()).kind;
}

let persistenceAsked = false;

/**
 * Попросить браузер не вычищать хранилище.
 *
 * Без этого книги — «лучшие усилия»: браузер вправе освободить место под нехватку, и они молча
 * исчезнут. Спрашивается один раз, при первом сохранении, и отказ не мешает работать: обещать, что
 * книга останется навсегда, мы и так не вправе — на iOS особенно.
 */
async function askPersistence(): Promise<void> {
  if (persistenceAsked) return;
  persistenceAsked = true;
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* отказ здесь ничего не меняет: файл всё равно пишется */
  }
}

/**
 * Хватит ли места — спрашивается **до** записи.
 *
 * Обрыв на середине двухсотмегабайтной книги оставляет огрызок файла и невнятную ошибку где-то в
 * середине сохранения. Отказ заранее говорит числами: сколько нужно и сколько есть.
 *
 * Запас в 5 % — не суеверие: браузер округляет и `usage`, и `quota`, а место рядом занимают
 * настройки, кэш и другие книги, которые пишутся в этот же момент.
 */
async function assertRoomFor(size: number): Promise<void> {
  const { used, quota } = await usage();
  if (!quota) return; // Браузер не сказал — значит, узнаем по факту записи.
  const free = quota - used;
  if (size * 1.05 <= free) return;
  throw new BookStorageError(
    `Книга занимает ${formatBytes(size)}, а на устройстве свободно ${formatBytes(Math.max(0, free))}. ` +
      'Удалите ненужные книги или сохраните эту в облаке.',
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

export async function putFile(sha256: string, blob: Blob): Promise<void> {
  try {
    await askPersistence();
    await assertRoomFor(blob.size);
    await (await backend()).put(sha256, blob);
    notifyFilesChanged();
  } catch (error) {
    if (error instanceof BookStorageError) throw error;
    fail('Не удалось сохранить книгу на устройстве', error);
  }
}

export async function getFile(sha256: string): Promise<Blob | undefined> {
  try {
    return await (await backend()).get(sha256);
  } catch (error) {
    if (error instanceof BookStorageError) throw error;
    fail('Не удалось прочитать книгу с устройства', error);
  }
}

export async function hasFile(sha256: string): Promise<boolean> {
  try {
    return await (await backend()).has(sha256);
  } catch {
    // Наличие книги спрашивают при отрисовке каждой карточки: отказавшее хранилище означает
    // «файла здесь нет», а не пустой список книг.
    return false;
  }
}

export async function deleteFile(sha256: string): Promise<void> {
  try {
    await (await backend()).delete(sha256);
    notifyFilesChanged();
  } catch (error) {
    if (error instanceof BookStorageError) throw error;
    fail('Не удалось удалить файл книги', error);
  }
}

/**
 * Сколько занято и сколько браузер вообще готов дать.
 *
 * Числа приблизительные и такими и показываются: браузер округляет их нарочно, чтобы по ним нельзя
 * было узнать посетителя.
 */
export async function usage(): Promise<StorageUsage> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return { used: estimate?.usage ?? 0, quota: estimate?.quota ?? 0 };
  } catch {
    return { used: 0, quota: 0 };
  }
}

/* --------------------------------------------------- Кто здесь что поменял */

/**
 * Подписка на изменения хранилища.
 *
 * Экран спрашивает «есть ли файл здесь» один раз на состав полки, и без оповещения ответ
 * застревает: книгу только что перенесли на устройство, а карточка по-прежнему пишет «файла нет».
 * Проверено прогоном — ровно так и было.
 */
const listeners = new Set<() => void>();

export function subscribeToFiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyFilesChanged(): void {
  for (const listener of listeners) listener();
}

/** Только для тестов: следующий вызов выберет хранилище заново. */
export function resetBackendForTests(): void {
  backendPromise = null;
  persistenceAsked = false;
}
