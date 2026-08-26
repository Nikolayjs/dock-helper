import { MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from '../../lib/xlsx/readSheet';
import type { DocumentSheet } from './types';

/**
 * Операции над таблицей документа — отдельно от редактора, чтобы их можно было проверить без DOM.
 *
 * Все возвращают новую таблицу и **не трогают** прежнюю. Массив изменённой строки создаётся заново,
 * а нетронутые строки передаются теми же ссылками: редактор мемоизирует строку по ссылке, и без
 * этого каждое нажатие клавиши перерисовывало бы весь реестр.
 */

export const MAX_ROWS = MAX_IMPORT_ROWS;
export const MAX_COLUMNS = MAX_IMPORT_COLUMNS;

function columnName(index: number): string {
  return `Столбец ${index + 1}`;
}

export function setCell(sheet: DocumentSheet, rowIndex: number, columnIndex: number, value: string): DocumentSheet {
  const rows = sheet.rows.map((row, index) => {
    if (index !== rowIndex) return row;
    const next = [...row];
    next[columnIndex] = value;
    return next;
  });
  return { ...sheet, rows };
}

export function setColumnName(sheet: DocumentSheet, columnIndex: number, name: string): DocumentSheet {
  const columns = [...sheet.columns];
  columns[columnIndex] = name;
  return { ...sheet, columns };
}

export function addRow(sheet: DocumentSheet): DocumentSheet {
  if (sheet.rows.length >= MAX_ROWS) return sheet;
  return { ...sheet, rows: [...sheet.rows, sheet.columns.map(() => '')] };
}

export function removeRow(sheet: DocumentSheet, rowIndex: number): DocumentSheet {
  return { ...sheet, rows: sheet.rows.filter((_, index) => index !== rowIndex) };
}

/** Новый столбец встаёт справа от указанного; без указания — в конец. */
export function addColumn(sheet: DocumentSheet, afterIndex?: number): DocumentSheet {
  if (sheet.columns.length >= MAX_COLUMNS) return sheet;
  const at = afterIndex === undefined ? sheet.columns.length : afterIndex + 1;

  const columns = [...sheet.columns];
  columns.splice(at, 0, columnName(sheet.columns.length));
  const rows = sheet.rows.map((row) => {
    const next = [...row];
    next.splice(at, 0, '');
    return next;
  });
  return { columns, rows };
}

/**
 * Последний столбец не удаляется: таблица без столбцов — это не таблица, а пустой экран, из
 * которого не видно, как вернуться назад.
 */
export function removeColumn(sheet: DocumentSheet, columnIndex: number): DocumentSheet {
  if (sheet.columns.length <= 1) return sheet;
  return {
    columns: sheet.columns.filter((_, index) => index !== columnIndex),
    rows: sheet.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
  };
}

/**
 * Разбирает то, что кладёт в буфер обмена Excel: ячейки через табуляцию, строки через перевод
 * строки, а ячейка с табуляцией, переводом строки или кавычкой внутри — в кавычках, где внутренняя
 * кавычка удвоена.
 *
 * Это главный способ наполнить таблицу: врач копирует кусок реестра из Excel и вставляет его сюда.
 * Без разбора вставился бы весь кусок в одну ячейку.
 */
export function parseClipboardGrid(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field === '') {
      quoted = true;
      continue;
    }
    if (char === '\t') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\r') continue;
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Excel кладёт в буфер завершающий перевод строки — без этого в таблице появлялась бы пустая строка.
  return rows.filter((cells, index) => index < rows.length - 1 || cells.some((cell) => cell !== ''));
}

/**
 * Кладёт разобранный кусок в таблицу, начиная с указанной ячейки.
 *
 * Таблица расширяется под вставку — и вниз, и вправо: врач копирует из Excel готовый фрагмент, и
 * обрезать его по текущему размеру сетки значило бы молча потерять данные. Новые столбцы получают
 * имена по номеру; переименовать их — одно нажатие, а вот восстановить потерянный столбец нечем.
 */
export function pasteInto(
  sheet: DocumentSheet,
  rowIndex: number,
  columnIndex: number,
  grid: string[][],
): DocumentSheet {
  const width = Math.min(MAX_COLUMNS, Math.max(sheet.columns.length, columnIndex + Math.max(...grid.map((r) => r.length))));
  const height = Math.min(MAX_ROWS, Math.max(sheet.rows.length, rowIndex + grid.length));

  const columns = Array.from({ length: width }, (_, index) => sheet.columns[index] ?? columnName(index));
  const rows = Array.from({ length: height }, (_, index) =>
    Array.from({ length: width }, (_, column) => sheet.rows[index]?.[column] ?? ''),
  );

  grid.forEach((cells, offsetRow) => {
    cells.forEach((value, offsetColumn) => {
      const row = rowIndex + offsetRow;
      const column = columnIndex + offsetColumn;
      if (row < height && column < width) rows[row][column] = value;
    });
  });

  return { columns, rows };
}

/**
 * Убирает пустые строки с конца перед сохранением.
 *
 * Новая таблица приходит с тремя пустыми строками, и без этого каждый реестр уносил бы их в .xlsx
 * хвостом. Пустые строки в середине остаются: там они могут быть разделителем, поставленным нарочно.
 */
export function trimTrailingRows(sheet: DocumentSheet): DocumentSheet {
  const rows = [...sheet.rows];
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) rows.pop();
  return { ...sheet, rows };
}

/** Пустая таблица — та, в которой ничего не написано ни в одной ячейке. Заголовки не в счёт. */
export function isSheetEmpty(sheet: DocumentSheet | null): boolean {
  return !sheet || sheet.rows.every((row) => row.every((cell) => cell.trim() === ''));
}
