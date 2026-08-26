import { readTableFile, type Cell } from '../../features/patients/import/readTable';

/**
 * Превращает прочитанный файл таблицы в сетку редактора.
 *
 * Читает файл тот же `readTableFile`, что и импорт картотеки пациентов: .xlsx и CSV, с определением
 * разделителя и кодировки. Здесь остаётся вторая половина работы — привести разнотипные ячейки к
 * строкам и сделать таблицу прямоугольной.
 */
export interface SheetGrid {
  columns: string[];
  rows: string[][];
}

/** Столько строк редактор ещё показывает, не превращаясь в слайд-шоу; столько же принимает бэкенд. */
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_COLUMNS = 40;

/**
 * Дата печатается по UTC, а не по местному времени.
 *
 * Разборщик собирает дату из порядкового номера Excel как полночь UTC. Формат по местному поясу
 * сдвинул бы её на день назад западнее Гринвича — то есть дата приёма в выгруженном реестре
 * зависела бы от того, где открыли файл.
 */
function displayDate(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${value.getUTCFullYear()}`;
}

function display(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return displayDate(cell);
  if (typeof cell === 'boolean') return cell ? 'да' : 'нет';
  return String(cell);
}

function isBlank(row: Cell[]): boolean {
  return row.every((cell) => display(cell).trim() === '');
}

/**
 * Первая непустая строка — заголовки, остальные — данные.
 *
 * Пустые строки выбрасываются целиком, включая те, что стоят перед заголовком: выгрузки из
 * лабораторных и учётных программ почти всегда начинаются с названия отчёта и пустой строки под
 * ним, и без этого заголовками стала бы именно она.
 *
 * Строки выравниваются по числу заголовков — сетка рисуется по нему, и ячейка правее последнего
 * столбца в редакторе была бы невидима, но уехала бы в выгруженный .xlsx.
 */
export function cellsToStrings(cells: Cell[][]): SheetGrid {
  const rows = cells.filter((row) => Array.isArray(row) && !isBlank(row)).slice(0, MAX_IMPORT_ROWS + 1);
  if (rows.length === 0) return { columns: [], rows: [] };

  const header = rows[0].slice(0, MAX_IMPORT_COLUMNS);
  const columns = header.map((cell, index) => display(cell).trim() || `Столбец ${index + 1}`);

  const body = rows.slice(1).map((row) => {
    const values = row.slice(0, columns.length).map(display);
    while (values.length < columns.length) values.push('');
    return values;
  });

  return { columns, rows: body };
}

/** Файл таблицы → сетка редактора. Ошибки чтения приходят из `readTableFile` как `TableFileError`. */
export async function readSheetFile(file: File): Promise<SheetGrid> {
  return cellsToStrings(await readTableFile(file));
}
