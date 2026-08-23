/**
 * DjVu.js is vendored as a plain script (public/vendor/djvu.js) rather than an npm
 * dependency — see the comment at the top of that file for why. It sets a global
 * `window.DjVu`; this module loads it lazily (only once a DjVu book is actually opened)
 * and gives the rest of the app a typed, promise-based handle to it.
 */

const SCRIPT_URL = '/vendor/djvu.js';

export interface DjvuPageSizeInfo {
  width: number;
  height: number;
  dpi: number;
}

export interface DjvuPngObjectData {
  url: string;
  byteLength: number;
  width: number;
  height: number;
  dpi: number;
}

/**
 * The library's async API is a `Proxy`-based task builder: each call on `worker.doc`
 * returns another chainable task, terminated by `.run()`. There's no meaningful static
 * shape to describe beyond that, so the chain itself is typed loosely on purpose.
 */
type DjVuTask = any;

export interface DjVuWorkerInstance {
  createDocument(buffer: ArrayBuffer, options?: { baseUrl?: string; memoryLimit?: number }): Promise<void>;
  readonly doc: DjVuTask;
  run(...tasks: DjVuTask[]): Promise<unknown>;
  terminate(): void;
}

export interface DjVuGlobal {
  VERSION: string;
  Worker: new () => DjVuWorkerInstance;
}

declare global {
  interface Window {
    DjVu?: DjVuGlobal;
  }
}

let loadPromise: Promise<DjVuGlobal> | null = null;

export function loadDjVu(): Promise<DjVuGlobal> {
  if (window.DjVu) return Promise.resolve(window.DjVu);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = () => {
      if (window.DjVu) resolve(window.DjVu);
      else reject(new Error('DjVu.js library failed to initialize'));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Не удалось загрузить библиотеку DjVu'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
