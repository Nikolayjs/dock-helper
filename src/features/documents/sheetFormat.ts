import type { CellFormat, DocumentSheet, SheetFormats } from './types';

/**
 * Оформление ячеек: начертание, выравнивание, заливка, числовой формат.
 *
 * Хранится разрежённой картой по адресу `строка:столбец` — в номерах Excel, где заголовки это
 * строка 1. Плотная сетка форматов весила бы столько же, сколько сама таблица, а размечены обычно
 * шапка да пара столбцов.
 *
 * **Формат обязан ездить вместе со своей ячейкой.** Вставка столбца, удаление строки и сортировка
 * двигают данные; формат, оставшийся на месте, покрасил бы соседа — и заметить это можно только
 * глазами. Поэтому все операции над таблицей проводят форматы через `remapFormats`.
 */

export function formatKey(row: number, column: number): string {
  return `${row}:${column}`;
}

export function parseFormatKey(key: string): { row: number; column: number } {
  const [row = NaN, column = NaN] = key.split(':').map(Number);
  return { row, column };
}

export function getFormat(formats: SheetFormats | undefined, row: number, column: number): CellFormat {
  return formats?.[formatKey(row, column)] ?? {};
}

/** Пустой формат из карты выбрасывается: иначе она разрастается ключами, которые ничего не значат. */
function withFormat(formats: SheetFormats, key: string, format: CellFormat): SheetFormats {
  const next = { ...formats };
  if (Object.keys(format).length === 0) delete next[key];
  else next[key] = format;
  return next;
}

export interface CellRange {
  /** Номера строк Excel, включительно. */
  top: number;
  bottom: number;
  /** Индексы столбцов, 0-based, включительно. */
  left: number;
  right: number;
}

export function normalizeRange(anchor: { row: number; column: number }, head: { row: number; column: number }): CellRange {
  return {
    top: Math.min(anchor.row, head.row),
    bottom: Math.max(anchor.row, head.row),
    left: Math.min(anchor.column, head.column),
    right: Math.max(anchor.column, head.column),
  };
}

export function rangeContains(range: CellRange, row: number, column: number): boolean {
  return row >= range.top && row <= range.bottom && column >= range.left && column <= range.right;
}

export function rangeCells(range: CellRange): { row: number; column: number }[] {
  const cells: { row: number; column: number }[] = [];
  for (let row = range.top; row <= range.bottom; row++) {
    for (let column = range.left; column <= range.right; column++) cells.push({ row, column });
  }
  return cells;
}

/**
 * Применяет правку формата ко всем ячейкам выделения.
 *
 * `undefined` в правке снимает свойство — это и есть «выключить полужирный», а не «оставить как
 * было»: панель переключает, а не только назначает.
 */
export function applyFormat(sheet: DocumentSheet, range: CellRange, patch: CellFormat): DocumentSheet {
  let formats: SheetFormats = { ...(sheet.formats ?? {}) };

  for (const { row, column } of rangeCells(range)) {
    const key = formatKey(row, column);
    const merged: CellFormat = { ...(formats[key] ?? {}), ...patch };
    for (const name of Object.keys(merged) as (keyof CellFormat)[]) {
      if (merged[name] === undefined || merged[name] === false) delete merged[name];
    }
    formats = withFormat(formats, key, merged);
  }

  return { ...sheet, formats };
}

export function clearFormat(sheet: DocumentSheet, range: CellRange): DocumentSheet {
  const formats: SheetFormats = { ...(sheet.formats ?? {}) };
  for (const { row, column } of rangeCells(range)) delete formats[formatKey(row, column)];
  return { ...sheet, formats };
}

/**
 * Свойство, общее для всего выделения, — иначе `undefined`.
 *
 * Панель по нему решает, нажата ли кнопка. Смешанное выделение (часть жирная, часть нет) не
 * показывается нажатым: обещать «здесь всё полужирное» там, где это не так, — то же враньё, что и
 * кнопка «назад», ведущая не туда.
 */
export function commonFormat<K extends keyof CellFormat>(
  formats: SheetFormats | undefined,
  range: CellRange,
  property: K,
): CellFormat[K] | undefined {
  const cells = rangeCells(range);
  if (cells.length === 0) return undefined;
  const [head] = cells;
  if (!head) return undefined;
  const first = getFormat(formats, head.row, head.column)[property];
  return cells.every((cell) => getFormat(formats, cell.row, cell.column)[property] === first) ? first : undefined;
}

/**
 * Переносит форматы на новые адреса.
 *
 * `move` возвращает новый адрес ячейки или `null`, если ячейка исчезла (удалённая строка или
 * столбец). Один проход на все операции: правило переноса должно быть одно, иначе оно разъедется
 * между вставкой столбца и сортировкой.
 */
export function remapFormats(
  formats: SheetFormats | undefined,
  move: (row: number, column: number) => { row: number; column: number } | null,
): SheetFormats | undefined {
  if (!formats || Object.keys(formats).length === 0) return formats;

  const next: SheetFormats = {};
  for (const [key, format] of Object.entries(formats)) {
    const { row, column } = parseFormatKey(key);
    const moved = move(row, column);
    if (moved) next[formatKey(moved.row, moved.column)] = format;
  }
  return next;
}

/** Числовые форматы, которые редактор предлагает, и их запись в терминах Excel. */
export const NUMBER_FORMATS: { value: NonNullable<CellFormat['numberFormat']>; label: string; code: string }[] = [
  { value: 'integer', label: 'Целое', code: '0' },
  { value: 'decimal', label: '0,00', code: '0.00' },
  { value: 'money', label: 'Рубли', code: '#,##0.00\\ "₽"' },
  { value: 'percent', label: 'Проценты', code: '0%' },
];

export function numberFormatCode(format: CellFormat['numberFormat']): string | undefined {
  return NUMBER_FORMATS.find((entry) => entry.value === format)?.code;
}

/** Заливки: светлые, чтобы чёрный текст поверх них читался и на экране, и на печати. */
export const FILL_COLORS: { color: string; label: string }[] = [
  { color: 'FFF3BF', label: 'Жёлтая' },
  { color: 'D3F9D8', label: 'Зелёная' },
  { color: 'FFE3E3', label: 'Красная' },
  { color: 'D0EBFF', label: 'Синяя' },
  { color: 'F1F3F5', label: 'Серая' },
];
