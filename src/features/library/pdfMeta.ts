import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export { pdfjsLib };

export interface PdfMeta {
  title: string;
  author: string;
  pageCount: number;
  coverDataUrl: string | null;
}

const COVER_WIDTH = 320;

export async function loadPdfDocument(data: ArrayBuffer) {
  // pdf.js transfers `data` to its worker, detaching the original buffer — clone it so
  // callers (and React StrictMode's double-invoked effects) can safely reuse their copy.
  return pdfjsLib.getDocument({ data: data.slice(0) }).promise;
}

export async function extractPdfMeta(data: ArrayBuffer): Promise<PdfMeta> {
  const doc = await loadPdfDocument(data);
  try {
    const pageCount = doc.numPages;
    let title = '';
    let author = '';
    try {
      const meta = await doc.getMetadata();
      const info = meta.info as Record<string, unknown>;
      if (typeof info.Title === 'string') title = info.Title.trim();
      if (typeof info.Author === 'string') author = info.Author.trim();
    } catch {
      // metadata is optional; fall back to filename-derived values upstream
    }

    let coverDataUrl: string | null = null;
    try {
      const page = await doc.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = COVER_WIDTH / baseViewport.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        coverDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      }
    } catch {
      // rendering the first page can fail for exotic PDFs; a missing cover is fine
    }

    return { title, author, pageCount, coverDataUrl };
  } finally {
    await doc.destroy();
  }
}
