import { columnLetter, FIRST_DATA_ROW, shiftFormula } from '../../lib/sheet/cellRef';
import { evaluateGrid, isFormula, literalValue } from '../../lib/sheet/formula';
import { MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from '../../lib/xlsx/readSheet';
import { remapFormats } from './sheetFormat';
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

/**
 * Новый столбец приходит без названия.
 *
 * Придуманное за врача «Столбец 4» пришлось бы стирать перед тем, как написать своё, а столбец и
 * без него назван — буквой в шапке, той же, которой он зовётся в формулах.
 */
function columnName(): string {
  return '';
}

/**
 * Лист целиком, как его видят формулы: нулевая строка — заголовки (строка 1 в адресах Excel),
 * дальше данные, и последней — строка итогов, если она есть.
 *
 * Нумерация здесь и в Excel одна и та же намеренно. Формула, которую врач печатает в приложении,
 * попадает в файл дословно, и перевод адресов между «нашей» и «экселевской» системой был бы местом,
 * где ошибиться легко, а заметить трудно.
 */
export function buildGrid(sheet: DocumentSheet): string[][] {
  return sheet.totals ? [sheet.columns, ...sheet.rows, sheet.totals] : [sheet.columns, ...sheet.rows];
}

/** Номер последней строки данных в адресах Excel; равен `HEADER_ROW`, если строк нет. */
export function lastDataRow(sheet: DocumentSheet): number {
  return sheet.rows.length + 1;
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

export function setTotalsCell(sheet: DocumentSheet, columnIndex: number, value: string): DocumentSheet {
  if (!sheet.totals) return sheet;
  const totals = [...sheet.totals];
  totals[columnIndex] = value;
  return { ...sheet, totals };
}

export function setColumnName(sheet: DocumentSheet, columnIndex: number, name: string): DocumentSheet {
  const columns = [...sheet.columns];
  columns[columnIndex] = name;
  return { ...sheet, columns };
}

/**
 * Ширина столбца и высота строки — свойства документа, а не показа.
 *
 * Таблицу печатают и выгружают в `.xlsx`, и столбец, расширенный ради длинных фамилий, обязан
 * остаться широким и там. Поэтому размеры лежат в самом документе, а массивы заводятся лениво: у
 * таблицы, которую никто не тянул, их нет вовсе — и в JSON они не занимают ни байта.
 */
export function setColumnWidth(sheet: DocumentSheet, columnIndex: number, chars: number | null): DocumentSheet {
  const widths = sheet.columns.map((_, index) => (index === columnIndex ? chars : (sheet.widths?.[index] ?? null)));
  return { ...sheet, widths: widths.some((value) => value !== null) ? widths : null };
}

export function setRowHeight(sheet: DocumentSheet, rowIndex: number, points: number | null): DocumentSheet {
  const heights = sheet.rows.map((_, index) => (index === rowIndex ? points : (sheet.heights?.[index] ?? null)));
  return { ...sheet, heights: heights.some((value) => value !== null) ? heights : null };
}

export function addRow(sheet: DocumentSheet): DocumentSheet {
  if (sheet.rows.length >= MAX_ROWS) return sheet;
  const rows = [...sheet.rows, sheet.columns.map(() => '')];
  const totalsRow = sheet.rows.length + FIRST_DATA_ROW;
  return {
    ...sheet,
    rows,
    // Новая строка своей высоты не имеет: она считается по содержимому, пока её не потянут.
    heights: sheet.heights ? [...sheet.heights, null] : sheet.heights,
    totals: retargetTotals(sheet, rows.length),
    // Строка итогов уезжает на строку вниз, и её оформление обязано уехать вместе с ней.
    formats: remapFormats(sheet.formats ?? undefined, (row, column) =>
      sheet.totals && row === totalsRow ? { row: row + 1, column } : { row, column },
    ),
  };
}

export function removeRow(sheet: DocumentSheet, rowIndex: number): DocumentSheet {
  const rows = sheet.rows.filter((_, index) => index !== rowIndex);
  const removed = rowIndex + FIRST_DATA_ROW;
  return {
    ...sheet,
    rows,
    heights: sheet.heights ? sheet.heights.filter((_, index) => index !== rowIndex) : sheet.heights,
    totals: retargetTotals(sheet, rows.length),
    formats: remapFormats(sheet.formats ?? undefined, (row, column) => {
      if (row === removed) return null;
      return row > removed ? { row: row - 1, column } : { row, column };
    }),
  };
}

/**
 * Дотягивает диапазоны строки итогов до нового конца таблицы.
 *
 * Без этого добавленная строка молча не попадала бы в сумму: `=СУММ(C2:C11)` осталось бы считать
 * первые десять строк из одиннадцати. В реестре это не косметика — это неверное число на бумаге,
 * которое ничем себя не выдаёт. Двигается только тот конец диапазона, который **стоял ровно на
 * прежней последней строке**: диапазон, который врач сузил намеренно, не трогается.
 */
function retargetTotals(sheet: DocumentSheet, newRowCount: number): string[] | null | undefined {
  if (!sheet.totals) return sheet.totals;
  const previousLast = lastDataRow(sheet);
  const nextLast = newRowCount + 1;
  if (previousLast === nextLast) return sheet.totals;

  return sheet.totals.map((cell) =>
    isFormula(cell)
      ? cell.replace(
          /(\$?[A-Za-z]{1,3}\$?)(\d{1,7}):(\$?[A-Za-z]{1,3}\$?)(\d{1,7})/g,
          (whole, fromCol: string, fromRow: string, toCol: string, toRow: string) =>
            Number(toRow) === previousLast ? `${fromCol}${fromRow}:${toCol}${nextLast}` : whole,
        )
      : cell,
  );
}

/** Новый столбец встаёт справа от указанного; без указания — в конец. */
export function addColumn(sheet: DocumentSheet, afterIndex?: number): DocumentSheet {
  if (sheet.columns.length >= MAX_COLUMNS) return sheet;
  const at = afterIndex === undefined ? sheet.columns.length : afterIndex + 1;

  const insert = <T,>(list: T[], value: T): T[] => {
    const next = [...list];
    next.splice(at, 0, value);
    return next;
  };

  return {
    ...sheet,
    columns: insert(sheet.columns, columnName()),
    rows: sheet.rows.map((row) => insert(row, '')),
    totals: sheet.totals ? insert(sheet.totals, '') : sheet.totals,
    widths: sheet.widths ? insert(sheet.widths, null) : sheet.widths,
    formats: remapFormats(sheet.formats ?? undefined, (row, column) =>
      column >= at ? { row, column: column + 1 } : { row, column },
    ),
  };
}

/**
 * Последний столбец не удаляется: таблица без столбцов — это не таблица, а пустой экран, из
 * которого не видно, как вернуться назад.
 */
export function removeColumn(sheet: DocumentSheet, columnIndex: number): DocumentSheet {
  if (sheet.columns.length <= 1) return sheet;
  const without = <T,>(list: T[]): T[] => list.filter((_, index) => index !== columnIndex);
  return {
    ...sheet,
    columns: without(sheet.columns),
    rows: sheet.rows.map(without),
    totals: sheet.totals ? without(sheet.totals) : sheet.totals,
    widths: sheet.widths ? without(sheet.widths) : sheet.widths,
    formats: remapFormats(sheet.formats ?? undefined, (row, column) => {
      if (column === columnIndex) return null;
      return column > columnIndex ? { row, column: column - 1 } : { row, column };
    }),
  };
}

// ─── Строка итогов ───────────────────────────────────────────────────────────

/**
 * Заводит строку итогов: сумму под каждым числовым столбцом.
 *
 * Числовым столбец считается по данным, а не по названию: если под заголовком «Дней» лежат числа,
 * их складывают, а под «Пациент» — нет. Первый столбец, в котором суммировать нечего, подписывается
 * словом «Итого», иначе строка выглядела бы оборванной.
 */
export function addTotalsRow(sheet: DocumentSheet): DocumentSheet {
  if (sheet.totals) return sheet;
  const last = lastDataRow(sheet);
  // По вычисленным значениям, а не по тексту ячеек: столбец `=B2*600` — это как раз тот столбец,
  // который и хотят просуммировать, а сырым текстом он выглядит как строка.
  const computed = evaluateGrid(buildGrid(sheet));

  const totals = sheet.columns.map((_, columnIndex) => {
    const numeric = computed
      .slice(1, sheet.rows.length + 1)
      .some((row) => typeof literalValue(row[columnIndex] ?? '') === 'number');
    if (!numeric) return '';
    return `=СУММ(${columnLetter(columnIndex)}${FIRST_DATA_ROW}:${columnLetter(columnIndex)}${last})`;
  });

  const firstEmpty = totals.findIndex((cell) => cell === '');
  if (firstEmpty !== -1) totals[firstEmpty] = 'Итого';

  return { ...sheet, totals };
}

export function removeTotalsRow(sheet: DocumentSheet): DocumentSheet {
  return { ...sheet, totals: null };
}

// ─── Сортировка ──────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

/**
 * Сравнение как в реестре: числа по величине, текст по алфавиту, пустые всегда внизу.
 *
 * Одно на редактор и на просмотр: в редакторе сортировка переставляет строки насовсем, в просмотре
 * — только показывает их в другом порядке, но упорядочивать они обязаны одинаково. Иначе один и тот
 * же реестр читался бы двумя разными способами.
 *
 * Одно на редактор и на просмотр: в редакторе сортировка переставляет строки насовсем, в просмотре
 * — только показывает их в другом порядке, но упорядочивать они обязаны одинаково. Иначе один и тот
 * же реестр читался бы двумя разными способами.
 *
 * Пустые не участвуют в направлении сортировки специально. «Показать сначала незаполненные» —
 * не то, чего хотят, нажимая «по убыванию»: пустая ячейка это отсутствие данных, а не наименьшее
 * из них.
 */
export function compareCells(a: string, b: string, direction: SortDirection): number {
  const emptyA = a.trim() === '';
  const emptyB = b.trim() === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const left = literalValue(a);
  const right = literalValue(b);
  const sign = direction === 'asc' ? 1 : -1;

  if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
  // Числа выше текста при любом направлении: смешанный столбец иначе перемешивал бы их вперемежку.
  if (typeof left === 'number') return -1;
  if (typeof right === 'number') return 1;
  return String(left).localeCompare(String(right), 'ru') * sign;
}

/**
 * Сортирует строки данных по столбцу.
 *
 * Две вещи, без которых сортировка врала бы:
 *
 * 1. **Сравниваются вычисленные значения, а не текст.** Столбец `=A2*600` — это числа, и сортировать
 *    его по строке «=A2*600» бессмысленно: все ячейки одинаковы посимвольно.
 * 2. **Относительные ссылки уезжают вместе со своей строкой.** Формула `=B5*600`, переехавшая в
 *    строку 3, обязана стать `=B3*600` — иначе она посчитает по чужим данным и не скажет об этом.
 *    Абсолютные (`$B$1`) остаются на месте, в этом и весь их смысл.
 *
 * Строка итогов не участвует — она вообще не строка данных.
 */
export function sortRows(sheet: DocumentSheet, columnIndex: number, direction: SortDirection): DocumentSheet {
  const computed = evaluateGrid(buildGrid(sheet));

  const ordered = sheet.rows
    .map((row, index) => ({ row, index, key: computed[index + 1]?.[columnIndex] ?? '' }))
    .sort((a, b) => compareCells(a.key, b.key, direction) || a.index - b.index);

  const rows = ordered.map((entry, newIndex) => {
    const delta = newIndex - entry.index;
    if (delta === 0 || !entry.row.some(isFormula)) return entry.row;
    return entry.row.map((cell) => (isFormula(cell) ? shiftFormula(cell, delta, 0) : cell));
  });

  // Куда уехала каждая строка — по этой же карте едет и её оформление: заливка, отмечавшая
  // просроченную явку, обязана остаться на той же явке, а не на том же месте.
  const movedTo = new Map<number, number>();
  ordered.forEach((entry, newIndex) => movedTo.set(entry.index + FIRST_DATA_ROW, newIndex + FIRST_DATA_ROW));

  return {
    ...sheet,
    rows,
    // Высота едет вместе со строкой по той же причине, что и заливка: она задана этой записи, а не
    // этому месту в реестре.
    heights: sheet.heights ? ordered.map((entry) => sheet.heights?.[entry.index] ?? null) : sheet.heights,
    formats: remapFormats(sheet.formats ?? undefined, (row, column) => ({
      row: movedTo.get(row) ?? row,
      column,
    })),
  };
}

// ─── Буфер обмена ────────────────────────────────────────────────────────────

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
export function pasteInto(sheet: DocumentSheet, rowIndex: number, columnIndex: number, grid: string[][]): DocumentSheet {
  const width = Math.min(MAX_COLUMNS, Math.max(sheet.columns.length, columnIndex + Math.max(...grid.map((r) => r.length))));
  const height = Math.min(MAX_ROWS, Math.max(sheet.rows.length, rowIndex + grid.length));

  const columns = Array.from({ length: width }, (_, index) => sheet.columns[index] ?? columnName());
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

  const totals = sheet.totals
    ? Array.from({ length: width }, (_, index) => sheet.totals?.[index] ?? '')
    : sheet.totals;

  // Размеры идут параллельными массивами и обязаны остаться той же длины, что таблица: вставка
  // расширяет её и вниз, и вправо, а строки и столбцы, появившиеся при этом, своей высоты и ширины
  // не имеют.
  const widths = sheet.widths ? Array.from({ length: width }, (_, index) => sheet.widths?.[index] ?? null) : sheet.widths;
  const heights = sheet.heights
    ? Array.from({ length: height }, (_, index) => sheet.heights?.[index] ?? null)
    : sheet.heights;

  return retargetSheet({ ...sheet, columns, rows, totals, widths, heights }, sheet);
}

/** Вставка меняет число строк, а значит диапазоны итогов надо дотянуть — тем же правилом. */
function retargetSheet(next: DocumentSheet, previous: DocumentSheet): DocumentSheet {
  return { ...next, totals: retargetTotals({ ...previous, totals: next.totals }, next.rows.length) };
}

// ─── Перед сохранением ───────────────────────────────────────────────────────

/**
 * Убирает пустые строки с конца перед сохранением.
 *
 * Новая таблица приходит с тремя пустыми строками, и без этого каждый реестр уносил бы их в .xlsx
 * хвостом. Пустые строки в середине остаются: там они могут быть разделителем, поставленным нарочно.
 */
export function trimTrailingRows(sheet: DocumentSheet): DocumentSheet {
  const rows = [...sheet.rows];
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) rows.pop();
  if (rows.length === sheet.rows.length) return sheet;
  return {
    ...sheet,
    rows,
    heights: sheet.heights ? sheet.heights.slice(0, rows.length) : sheet.heights,
    totals: retargetTotals(sheet, rows.length),
  };
}

/** Пустая таблица — та, в которой ничего не написано ни в одной ячейке. Заголовки не в счёт. */
export function isSheetEmpty(sheet: DocumentSheet | null): boolean {
  return !sheet || (sheet.rows.every((row) => row.every((cell) => cell.trim() === '')) && !sheet.totals);
}
