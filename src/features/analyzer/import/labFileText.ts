import { request } from '../../../lib/httpRepository';
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
    if (row && Math.abs(row[0].y - fragment.y) <= tolerance) row.push(fragment);
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
        fragments.push({ text: item.str, x: transform[4], y: transform[5] });
      }
      lines.push(...assembleLines(fragments, PDF_LINE_TOLERANCE_PT));
    }
    return lines;
  } finally {
    await doc.destroy();
  }
}

async function linesFromImage(file: File): Promise<string[]> {
  const form = new FormData();
  form.append('image', file, file.name || 'analysis.png');
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

export async function extractLabFileLines(file: File): Promise<string[]> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const lines = await linesFromPdf(file);
    if (lines.length === 0) {
      throw new LabFileError(
        'В этом PDF нет текстового слоя — похоже, он собран из сканов. Сфотографируйте бланк и загрузите снимок.',
      );
    }
    return lines;
  }

  if (OCR_IMAGE_TYPES.includes(file.type)) return linesFromImage(file);

  throw new LabFileError('Поддерживаются PDF и снимки (JPG, PNG, WEBP, TIFF, BMP).');
}
