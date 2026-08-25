// The browser entry point specifically: the package publishes no root export, and the node build
// reaches for `fs`.
import readXlsxFile from 'read-excel-file/browser';

/**
 * Reads a patient list into rows of cells, whatever it arrived as.
 *
 * A spreadsheet is the one format in this app that comes with its structure intact — cells are
 * cells, and no column boundary has to be guessed at from coordinates. That is the whole reason to
 * prefer it for something as consequential as a patient register.
 *
 * Cells keep their type. A date-formatted column hands back a Date, and losing that to a string
 * would mean re-deciding whether `03.04.1985` is March or April on the way back out.
 */

export type Cell = string | number | boolean | Date | null;

export class TableFileError extends Error {}

/** Enough rows to find a header and show a preview without holding a huge register twice over. */
const MAX_ROWS = 5000;

function detectDelimiter(line: string): string {
  // Russian Excel writes CSV with semicolons, because the comma is the decimal separator.
  const counts = [';', ',', '\t'].map((d) => ({ d, n: line.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0].n > 1 ? counts.sort((a, b) => b.n - a.n)[0].d : ';';
}

/** RFC-4180-ish: quoted fields may contain the delimiter, newlines and doubled quotes. */
function parseCsv(text: string): Cell[][] {
  const delimiter = detectDelimiter(text.slice(0, text.indexOf('\n') + 1 || text.length));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === delimiter) { row.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += char;
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }

  return rows.map((cells) => cells.map((cell) => cell.trim() || null));
}

export async function readTableFile(file: File): Promise<Cell[][]> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    // Registries exported from Windows software are often cp1251; UTF-8 decoding would turn every
    // name into mojibake, so a failed strict decode falls back rather than importing rubbish.
    const buffer = await file.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('windows-1251').decode(buffer);
    }
    return parseCsv(text).slice(0, MAX_ROWS);
  }

  if (name.endsWith('.xlsx')) {
    // Called without a sheet, version 9 hands back every sheet as `{ sheet, data }` rather than the
    // rows older versions returned. Both shapes are accepted so an upgrade cannot quietly turn a
    // register into "не удалось прочитать файл"; only the first sheet is read either way.
    const result = (await readXlsxFile(file)) as unknown;
    const first = Array.isArray(result) ? result[0] : undefined;
    const raw: unknown[] =
      first && typeof first === 'object' && !Array.isArray(first) && 'data' in first
        ? ((first as { data: unknown[] }).data ?? [])
        : ((result as unknown[]) ?? []);

    // A blank row does not always come back as an array, and a register with a spacer line under
    // its title is the ordinary case — normalised here rather than guarded at every walk site.
    return raw.slice(0, MAX_ROWS).map((row) => (Array.isArray(row) ? (row as Cell[]) : []));
  }

  if (name.endsWith('.xls')) {
    throw new TableFileError('Старый формат .xls не поддерживается — пересохраните файл как .xlsx в Excel.');
  }

  throw new TableFileError('Поддерживаются таблицы Excel (.xlsx) и CSV.');
}
