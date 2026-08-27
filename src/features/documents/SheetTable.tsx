import { Text } from '@mantine/core';

import { columnLetter } from '../../lib/sheet/cellRef';
import { evaluateGrid } from '../../lib/sheet/formula';
import { getFormat } from './sheetFormat';
import classes from './SheetTable.module.css';
import { buildGrid } from './sheetOps';
import type { CellFormat, DocumentSheet } from './types';

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

export function SheetTable({ sheet }: { sheet: DocumentSheet | null }) {
  if (!sheet || sheet.columns.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Таблица пуста.
      </Text>
    );
  }

  const formats = sheet.formats ?? undefined;
  const computed = evaluateGrid(buildGrid(sheet));
  const rows = computed.slice(1, sheet.rows.length + 1);
  const totals = sheet.totals ? computed[sheet.rows.length + 1] : null;

  return (
    <div className={classes.frame}>
      <table className={classes.table}>
        <thead>
          <tr>
            {sheet.columns.map((column, index) => (
              <th key={index} className={classes.headCell} style={cellStyle(getFormat(formats, 1, index))}>
                {column.trim() || <span className={classes.letter}>{columnLetter(index)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={classes.row}>
              {row.map((cell, columnIndex) => (
                <td key={columnIndex} className={classes.cell} style={cellStyle(getFormat(formats, rowIndex + 2, columnIndex))}>
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
