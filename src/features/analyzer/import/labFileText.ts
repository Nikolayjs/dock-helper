/**
 * Превращает файл с результатами анализов в строки текста.
 *
 * Источник ровно один — **текстовый слой PDF**, то есть в точности то, что напечатала лаборатория,
 * без единой догадки. Распознавание картинок отсюда убрано намеренно (`CLAUDE.md`, раздел про
 * бланки анализов): потолок замера — 28 показателей из 36 на приличной картинке, а на настоящем
 * бланке врача выходило «тюкоза» вместо «Глюкоза». Данные, по которым потом лечат, догадок не
 * терпят. OCR остался там, где он к месту, — в конструкторе бланков документов: там распознанное
 * правит врач и ошибку видно сразу.
 *
 * Строки приезжают позиционированными обрывками, и это главное здесь: бланк — таблица, а
 * «Гемоглобин» и «145» лежат в ней отдельными кусками и значат что-то только вместе. Поэтому файл
 * занят одним — сборкой строк по вертикали; склейка в порядке документа перемешала бы столбцы и
 * разрушила бы пары, на которых держится разборщик.
 */

interface TextFragment {
  text: string;
  x: number;
  y: number;
}

/** Fragments within this much of each other vertically are treated as one row. */
const PDF_LINE_TOLERANCE_PT = 3;

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
  // действительно открыл бланк из лаборатории.
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

export async function extractLabFileLines(file: File): Promise<string[]> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    throw new LabFileError('Читается только PDF из лаборатории — тот, что она присылает файлом.');
  }

  const lines = await linesFromPdf(file);
  if (lines.length === 0) {
    // Отказ обязан называть дорогу, а не только беду: PDF без текстового слоя — это скан, и
    // прочитать его точно нельзя ничем. Лаборатории почти всегда отдают и обычный PDF тоже.
    throw new LabFileError(
      'В этом PDF нет текстового слоя — внутри картинка. Попросите в лаборатории обычный PDF ' +
        '(в личном кабинете он обычно есть) или внесите значения руками.',
    );
  }
  return lines;
}
