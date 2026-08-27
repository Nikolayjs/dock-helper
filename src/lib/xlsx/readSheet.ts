import { readTableFile, type Cell } from '../../features/patients/import/readTable';
import { FIRST_DATA_ROW, shiftFormula } from '../sheet/cellRef';
import { formulaKey, readFormulasFromXlsx } from './readFormulas';

/**
 * Превращает прочитанный файл таблицы в сетку редактора.
 *
 * Читает файл тот же `readTableFile`, что и импорт картотеки пациентов: .xlsx и CSV, с определением
 * разделителя и кодировки. Здесь остаётся вторая половина работы — привести разнотипные ячейки к
 * строкам, сделать таблицу прямоугольной и вернуть на место формулы, которых разборщик значений не
 * видит.
 */
export interface SheetGrid {
  columns: string[];
  rows: string[][];
  /**
   * Номер строки в исходном файле для каждой строки данных, 1-based, как в Excel.
   *
   * Нужен из-за того, что пустые строки выбрасываются: выгрузка из учётной программы почти всегда
   * начинается с названия отчёта и пустой строки под ним, и после их удаления строка №7 файла
   * становится строкой №3 таблицы. Формула `=B7*600`, перенесённая дословно, считала бы по чужим
   * данным — поэтому её сдвигают ровно на ту же разницу.
   */
  sourceRows: number[];
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
  const kept = cells
    .map((row, index) => ({ row, sourceRow: index + 1 }))
    .filter((entry) => Array.isArray(entry.row) && !isBlank(entry.row))
    .slice(0, MAX_IMPORT_ROWS + 1);

  if (kept.length === 0) return { columns: [], rows: [], sourceRows: [] };

  const header = kept[0].row.slice(0, MAX_IMPORT_COLUMNS);
  // Пустая ячейка шапки остаётся пустой: столбец назван буквой, а придуманное имя врачу пришлось бы
  // стирать перед тем, как написать своё.
  const columns = header.map((cell) => display(cell).trim());

  const body = kept.slice(1);
  const rows = body.map((entry) => {
    const values = entry.row.slice(0, columns.length).map(display);
    while (values.length < columns.length) values.push('');
    return values;
  });

  return { columns, rows, sourceRows: body.map((entry) => entry.sourceRow) };
}

/**
 * Возвращает формулы на их места и сдвигает их на столько строк, на сколько уехала сама строка.
 *
 * Значение из `<v>` при этом отбрасывается: в ячейке остаётся формула, а число редактор посчитает
 * сам. Иначе на экране было бы одно, а в ячейке — другое.
 */
function applyFormulas(grid: SheetGrid, formulas: Map<string, string>): SheetGrid {
  if (formulas.size === 0) return grid;

  const rows = grid.rows.map((row, index) => {
    const sourceRow = grid.sourceRows[index];
    const targetRow = index + FIRST_DATA_ROW;
    const delta = targetRow - sourceRow;

    let changed = false;
    const next = row.map((cell, column) => {
      const formula = formulas.get(formulaKey(sourceRow, column));
      if (!formula) return cell;
      changed = true;
      return delta === 0 ? formula : shiftFormula(formula, delta, 0);
    });
    return changed ? next : row;
  });

  // Формула в строке заголовков не переносится: заголовок — это название столбца, а не расчёт, и
  // прочитанный текст здесь честнее живой формулы.
  return { ...grid, rows };
}

/** Файл таблицы → сетка редактора. Ошибки чтения приходят из `readTableFile` как `TableFileError`. */
export async function readSheetFile(file: File): Promise<SheetGrid> {
  const grid = cellsToStrings(await readTableFile(file));
  if (!file.name.toLowerCase().endsWith('.xlsx')) return grid;

  const formulas = readFormulasFromXlsx(new Uint8Array(await file.arrayBuffer()));
  return applyFormulas(grid, formulas);
}
