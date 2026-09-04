import { request } from '../../../lib/httpRepository';
import { OCR_TARGET_WIDTH, fitForOcr } from '../../../lib/ocrImage';
import type { TemplateLayout } from '../../patients/documents/layoutTypes';

/**
 * Turns a lab result file into lines of text.
 *
 * Two sources, one shape. A PDF from Инвитро or Хеликс carries real text, so it is read exactly and
 * never guessed at; a photograph has to go through OCR and comes back approximate. Both arrive as
 * positioned fragments, which is what matters: a lab report is a table, and "Гемоглобин" and "145"
 * are separate fragments that only mean something once they are known to sit on the same row.
 * Reassembling rows by vertical position is therefore the whole job here — concatenating fragments
 * in document order would interleave columns and destroy the pairing the parser depends on.
 */

interface TextFragment {
  text: string;
  x: number;
  y: number;
}

/** Fragments within this much of each other vertically are treated as one row. */
const PDF_LINE_TOLERANCE_PT = 3;
const OCR_LINE_TOLERANCE_PCT = 1.2;

const OCR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp'];

export class LabFileError extends Error {}

function assembleLines(fragments: TextFragment[], tolerance: number): string[] {
  const rows: TextFragment[][] = [];
  // Descending y: PDF user space grows upward, so the top of the page is the largest value.
  for (const fragment of [...fragments].sort((a, b) => b.y - a.y)) {
    const row = rows[rows.length - 1];
    const first = row?.[0];
    if (row && first && Math.abs(first.y - fragment.y) <= tolerance) row.push(fragment);
    else rows.push([fragment]);
  }

  return rows
    .map((row) =>
      [...row]
        .sort((a, b) => a.x - b.x)
        .map((f) => f.text.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

async function linesFromPdf(file: File): Promise<string[]> {
  // pdf.js подключается здесь, а не сверху файла: это 94 КБ gzip, и нужны они только тому, кто
  // действительно принёс PDF из лаборатории. Снимок с телефона идёт через OCR и без них.
  const { loadPdfDocument } = await import('../../library/pdfMeta');
  const doc = await loadPdfDocument(await file.arrayBuffer());
  try {
    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const fragments: TextFragment[] = [];
      for (const item of content.items) {
        // Image-only items have no `str`; a scanned-to-PDF report yields none of these at all,
        // which is what the caller reports as "no text found" rather than silently succeeding.
        if (!('str' in item) || typeof item.str !== 'string' || !item.str.trim()) continue;
        const transform = (item as { transform: number[] }).transform;
        // Матрица преобразования PDF всегда из шести чисел; пятое и шестое — сдвиг по x и y.
        fragments.push({ text: item.str, x: transform[4] ?? 0, y: transform[5] ?? 0 });
      }
      lines.push(...assembleLines(fragments, PDF_LINE_TOLERANCE_PT));
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}

async function linesFromImage(image: Blob, fileName: string): Promise<string[]> {
  const file = await fitForOcr(image);
  const form = new FormData();
  form.append('image', file, fileName || 'analysis.png');
  // Reuses the OCR endpoint built for scanning blank forms: it persists nothing, returns positioned
  // text blocks, and already carries the HEIC rejection and Russian-language Tesseract setup.
  const layout = await request<TemplateLayout>('/document-templates/recognize', { method: 'POST', body: form });
  const fragments = layout.blocks.map((block) => ({
    text: block.text,
    x: block.xPct,
    // OCR geometry grows downward; negate so it shares assembleLines' top-is-larger convention.
    y: -block.yPct,
  }));
  return assembleLines(fragments, OCR_LINE_TOLERANCE_PCT);
}

/**
 * PDF без текстового слоя — тоже бланк, просто собранный из картинок.
 *
 * Раньше здесь стоял тупик: «сфотографируйте бланк и загрузите снимок». Совет вредный — снимок
 * экрана или фотография выходят хуже, чем страница, нарисованная **нами** в нужном размере: у нас
 * нет ни бликов, ни перекоса, ни чужого масштаба. Отсюда и правило: рисуем страницу сами, ровно в
 * ту ширину, на которой распознавание работает.
 *
 * Страниц берётся не больше четырёх: бланк лаборатории — это одна-две, а каждая страница стоит
 * отдельного распознавания в несколько секунд. Пятая почти всегда означала бы, что подали не бланк.
 */
const OCR_PDF_PAGE_LIMIT = 4;

async function linesFromScannedPdf(file: File): Promise<string[]> {
  const { loadPdfDocument } = await import('../../library/pdfMeta');
  const doc = await loadPdfDocument(await file.arrayBuffer());
  try {
    const lines: string[] = [];
    const pages = Math.min(doc.numPages, OCR_PDF_PAGE_LIMIT);
    for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: OCR_TARGET_WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext('2d');
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;

      const rendered = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!rendered) continue;
      lines.push(...(await linesFromImage(rendered, `page-${pageNumber}.png`)));
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}

/**
 * Каким путём прочитан бланк.
 *
 * Врачу это видно в окне разбора, и не ради подробностей: разница в качестве между путями
 * огромна. Текстовый слой PDF — это ровно то, что напечатала лаборатория, без единой ошибки;
 * распознавание — догадка по картинке. Не сказав, каким путём пошло, мы оставляем врача с
 * ощущением «приложение плохо читает» там, где на самом деле ему подали снимок экрана вместо
 * файла.
 */
export type LabFileSource = 'pdf-text' | 'pdf-scan' | 'image';

export interface LabFileLines {
  lines: string[];
  source: LabFileSource;
}

export async function extractLabFileLines(file: File): Promise<LabFileLines> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const lines = await linesFromPdf(file);
    if (lines.length > 0) return { lines, source: 'pdf-text' };

    // Текстового слоя нет — значит бланк внутри картинкой. Рисуем страницы сами и распознаём.
    const scanned = await linesFromScannedPdf(file);
    if (scanned.length === 0) {
      throw new LabFileError('В этом PDF не нашлось ни текста, ни читаемого изображения бланка.');
    }
    return { lines: scanned, source: 'pdf-scan' };
  }

  if (OCR_IMAGE_TYPES.includes(file.type)) return { lines: await linesFromImage(file, file.name), source: 'image' };

  throw new LabFileError('Поддерживаются PDF и снимки (JPG, PNG, WEBP, TIFF, BMP).');
}
