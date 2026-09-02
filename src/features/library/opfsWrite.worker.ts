/**
 * Запись книги в OPFS через `createSyncAccessHandle`.
 *
 * Основной путь — `createWritable()` в обычном потоке, и он есть в Chrome, Firefox и Safari 17.
 * До Safari 17 OPFS отдавался, но писать в него можно было **только из воркера** синхронной ручкой.
 * Эта ветка ради тех читателей: без неё у них книга «сохранялась» и не сохранялась.
 *
 * Синхронная ручка блокирует поток на время записи — потому она и живёт в воркере, а не рядом с
 * интерфейсом. Пишется кусками по 4 МБ: одним куском двухсотмегабайтная книга требует такого же
 * буфера в памяти, а это ровно то, чего мы избегаем.
 */
const CHUNK = 4 * 1024 * 1024;

/**
 * Синхронной ручки нет в типах DOM этой версии TypeScript — она появилась позже.
 * Описываем ровно то, чем пользуемся: обещать больше значило бы обещать за браузер.
 */
interface SyncAccessHandle {
  write(data: BufferSource, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

type FileHandleWithSyncAccess = FileSystemFileHandle & { createSyncAccessHandle(): Promise<SyncAccessHandle> };

self.onmessage = async (event: MessageEvent<{ directory: string; name: string; blob: Blob }>) => {
  const { directory, name, blob } = event.data;
  let handle: SyncAccessHandle | undefined;
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(directory, { create: true });
    const file = await dir.getFileHandle(name, { create: true });
    handle = await (file as FileHandleWithSyncAccess).createSyncAccessHandle();
    handle.truncate(0);
    let offset = 0;
    while (offset < blob.size) {
      const slice = blob.slice(offset, Math.min(offset + CHUNK, blob.size));
      const bytes = new Uint8Array(await slice.arrayBuffer());
      handle.write(bytes, { at: offset });
      offset += bytes.byteLength;
    }
    handle.flush();
    self.postMessage({ ok: true });
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : 'write failed' });
  } finally {
    handle?.close();
  }
};
