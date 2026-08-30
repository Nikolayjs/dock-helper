import { useRef, useState } from 'react';
import { Text } from '@mantine/core';

import { columnLetter } from '../../lib/sheet/cellRef';
import { evaluateGrid } from '../../lib/sheet/formula';
import { getFormat } from './sheetFormat';
import classes from './SheetTable.module.css';
import { buildGrid, compareCells, type SortDirection } from './sheetOps';
import type { CellFormat, DocumentSheet } from './types';
import { useFittedHeight } from '../../components/common/useFittedHeight';

/**
 * Таблица документа для чтения.
 *
 * Показывает результаты формул, а не их текст: на бумаге и в выгруженном файле стоят числа, и
 * просмотр обязан показывать ровно то же. Оформление ячеек — тоже: заливка и выравнивание, заданные
 * в редакторе, уходят в .xlsx, и страница, показывающая документ иначе, вводила бы в заблуждение.
 *
 * Прокрутка у рамки своя, и по высоте тоже — см. `SheetTable.module.css` о том, почему.
 */
function cellStyle(format: CellFormat): React.CSSProperties {
  return {
    fontWeight: format.bold ? 600 : undefined,
    fontStyle: format.italic ? 'italic' : undefined,
    textAlign: format.align,
    backgroundColor: format.fill ? `#${format.fill}` : undefined,
    // На залитой ячейке текст всегда тёмный: заливки светлые и в тёмной теме остаются светлыми.
    color: format.fill ? '#212529' : undefined,
  };
}

/** Под рамкой в просмотре ничего нет — хватает поля до края страницы. */
const BOTTOM_RESERVE = 32;
const MIN_FRAME_HEIGHT = 220;

/** Нажатие по заголовку: по возрастанию → по убыванию → как в документе. */
function nextSort(
  current: { column: number; direction: SortDirection } | null,
  column: number,
): { column: number; direction: SortDirection } | null {
  if (!current || current.column !== column) return { column, direction: 'asc' };
  return current.direction === 'asc' ? { column, direction: 'desc' } : null;
}

export function SheetTable({ sheet }: { sheet: DocumentSheet | null }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const frameHeight = useFittedHeight(frameRef, { reserve: BOTTOM_RESERVE, min: MIN_FRAME_HEIGHT });

  /**
   * Сортировка в просмотре — только показ, и это разница с редактором.
   *
   * Здесь нечего переставлять: документ уже написан, и порядок строк в нём — часть документа.
   * Читающему при этом нужно бывает пересобрать реестр по своему столбцу, и раз ничего не
   * сохраняется, третьим нажатием порядок возвращается к тому, что в документе.
   */
  const [sort, setSort] = useState<{ column: number; direction: SortDirection } | null>(null);

  if (!sheet || sheet.columns.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Таблица пуста.
      </Text>
    );
  }

  const formats = sheet.formats ?? undefined;
  const computed = evaluateGrid(buildGrid(sheet));
  // Номер строки едет вместе с ней: по нему ищется оформление, и заливка обязана остаться на своей
  // ячейке — ровно по той же причине, по которой её проводит через сортировку редактор.
  const rows = computed.slice(1, sheet.rows.length + 1).map((cells, index) => ({ cells, excelRow: index + 2 }));
  const ordered = sort
    ? [...rows].sort(
        (a, b) =>
          compareCells(a.cells[sort.column] ?? '', b.cells[sort.column] ?? '', sort.direction) || a.excelRow - b.excelRow,
      )
    : rows;
  // Строка итогов не сортируется никогда: итог посреди реестра — не мелкий изъян, а неверная бумага.
  const totals = sheet.totals ? computed[sheet.rows.length + 1] : null;

  return (
    <div className={classes.frame} ref={frameRef} style={{ maxHeight: frameHeight ?? undefined }}>
      <table className={classes.table}>
        <thead>
          <tr>
            {sheet.columns.map((column, index) => (
              <th
                key={index}
                className={`${classes.headCell} ${classes.sortable}`}
                style={cellStyle(getFormat(formats, 1, index))}
                onClick={() => setSort((current) => nextSort(current, index))}
                aria-sort={sort?.column === index ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                title="Сортировка: по возрастанию → по убыванию → как в документе"
              >
                {column.trim() || <span className={classes.letter}>{columnLetter(index)}</span>}
                {/* Место под стрелку занято всегда: иначе первое же нажатие раздвинуло бы столбец. */}
                <span className={classes.sortMark}>{sort?.column === index ? (sort.direction === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((entry) => (
            <tr key={entry.excelRow} className={classes.row}>
              {entry.cells.map((cell, columnIndex) => (
                <td key={columnIndex} className={classes.cell} style={cellStyle(getFormat(formats, entry.excelRow, columnIndex))}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr>
              {totals.map((cell, columnIndex) => (
                <td
                  key={columnIndex}
                  className={classes.totalsCell}
                  style={cellStyle(getFormat(formats, sheet.rows.length + 2, columnIndex))}
                >
                  {cell}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
