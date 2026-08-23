import { loadDjVu, type DjvuPageSizeInfo, type DjVuWorkerInstance, type DjvuPngObjectData } from './djvuLoader';

export type { DjvuPageSizeInfo };

export interface DjvuDocumentHandle {
  pageCount: number;
  pagesSizes: DjvuPageSizeInfo[];
  /** Renders a page to a PNG and returns an object URL — caller must revoke it when done. */
  renderPage(pageNumber: number): Promise<DjvuPngObjectData>;
  destroy(): void;
}

export async function loadDjvuDocument(data: ArrayBuffer): Promise<DjvuDocumentHandle> {
  const DjVu = await loadDjVu();
  const worker: DjVuWorkerInstance = new DjVu.Worker();
  // The worker transfers (detaches) whatever buffer it's given, so hand it a copy.
  await worker.createDocument(data.slice(0));
  const pageCount = (await worker.doc.getPagesQuantity().run()) as number;
  const pagesSizes = (await worker.doc.getPagesSizes().run()) as DjvuPageSizeInfo[];

  return {
    pageCount,
    pagesSizes,
    renderPage: (pageNumber: number) => worker.doc.getPage(pageNumber).createPngObjectUrl().run() as Promise<DjvuPngObjectData>,
    destroy: () => worker.terminate(),
  };
}

async function blobUrlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface DjvuMeta {
  pageCount: number;
  coverDataUrl: string | null;
}

export async function extractDjvuMeta(data: ArrayBuffer): Promise<DjvuMeta> {
  const handle = await loadDjvuDocument(data);
  try {
    let coverDataUrl: string | null = null;
    try {
      const cover = await handle.renderPage(1);
      coverDataUrl = await blobUrlToDataUrl(cover.url);
      URL.revokeObjectURL(cover.url);
    } catch {
      // a missing cover is fine — the card just shows a placeholder icon
    }
    return { pageCount: handle.pageCount, coverDataUrl };
  } finally {
    handle.destroy();
  }
}
