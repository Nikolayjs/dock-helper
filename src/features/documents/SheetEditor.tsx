import { memo, useCallback, useRef } from 'react';
import { ActionIcon, Button, Group, Menu, Text } from '@mantine/core';
import { IconDotsVertical, IconPlus, IconTrash } from '@tabler/icons-react';

import classes from './SheetEditor.module.css';
import {
  addColumn,
  addRow,
  MAX_COLUMNS,
  MAX_ROWS,
  parseClipboardGrid,
  pasteInto,
  removeColumn,
  removeRow,
  setCell,
  setColumnName,
} from './sheetOps';
import type { DocumentSheet } from './types';

interface SheetEditorProps {
  value: DocumentSheet;
  onChange: (sheet: DocumentSheet) => void;
}

/**
 * Строка таблицы, мемоизированная по ссылке на массив ячеек.
 *
 * Реестр на двести строк — это тысяча полей ввода. Без мемоизации каждое нажатие клавиши
 * перерисовывало бы их все, и печать в дальней ячейке начинала бы заметно отставать. Операции в
 * `sheetOps` для того и пересоздают только изменённую строку.
 */
const SheetRow = memo(function SheetRow({
  cells,
  rowIndex,
  onCell,
  onPaste,
  onRemove,
  onEnter,
}: {
  cells: string[];
  rowIndex: number;
  onCell: (rowIndex: number, columnIndex: number, value: string) => void;
  onPaste: (rowIndex: number, columnIndex: number, text: string) => boolean;
  onRemove: (rowIndex: number) => void;
  onEnter: (rowIndex: number, columnIndex: number) => void;
}) {
  return (
    <tr>
      <td className={classes.numberCell}>{rowIndex + 1}</td>
      {cells.map((cell, columnIndex) => (
        <td key={columnIndex} className={classes.bodyCell}>
          <input
            className={classes.input}
            value={cell}
            data-cell={`${rowIndex}:${columnIndex}`}
            aria-label={`Строка ${rowIndex + 1}, столбец ${columnIndex + 1}`}
            onChange={(event) => onCell(rowIndex, columnIndex, event.currentTarget.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text/plain');
              if (onPaste(rowIndex, columnIndex, text)) event.preventDefault();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onEnter(rowIndex, columnIndex);
              }
            }}
          />
        </td>
      ))}
      <td className={classes.rowActions}>
        <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Удалить строку ${rowIndex + 1}`} onClick={() => onRemove(rowIndex)}>
          <IconTrash size={14} />
        </ActionIcon>
      </td>
    </tr>
  );
});

/**
 * Сетка ячеек: строка заголовков и строки значений.
 *
 * Значения — строки, а не числа и даты. Таблица здесь бумага, а не расчёт: врач пишет «12.09» и «до
 * 3 дней», и попытка угадать тип превратила бы одно в дату, а второе оставила текстом. Числами
 * ячейки становятся ровно один раз — при выгрузке в .xlsx, и по осторожному правилу (см.
 * `numericValue`).
 */
export function SheetEditor({ value, onChange }: SheetEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  const focusCell = useCallback((rowIndex: number, columnIndex: number) => {
    // В следующем кадре: строка, добавленная тем же нажатием, ещё не появилась в DOM.
    requestAnimationFrame(() => {
      frameRef.current?.querySelector<HTMLInputElement>(`[data-cell="${rowIndex}:${columnIndex}"]`)?.focus();
    });
  }, []);

  const handleCell = useCallback(
    (rowIndex: number, columnIndex: number, cell: string) => onChange(setCell(value, rowIndex, columnIndex, cell)),
    [onChange, value],
  );

  /**
   * Вставка из Excel. Кусок из одной ячейки пропускается в браузер — так работает обычная вставка
   * внутри поля, включая замену выделенной части; всё остальное раскладывается по сетке.
   */
  const handlePaste = useCallback(
    (rowIndex: number, columnIndex: number, text: string) => {
      if (!text.includes('\t') && !text.includes('\n')) return false;
      const grid = parseClipboardGrid(text);
      if (grid.length === 0) return false;
      onChange(pasteInto(value, rowIndex, columnIndex, grid));
      return true;
    },
    [onChange, value],
  );

  /** Enter уводит вниз, как в Excel; на последней строке заводит новую — иначе ввод упирается в стену. */
  const handleEnter = useCallback(
    (rowIndex: number, columnIndex: number) => {
      if (rowIndex === value.rows.length - 1) onChange(addRow(value));
      focusCell(rowIndex + 1, columnIndex);
    },
    [focusCell, onChange, value],
  );

  const handleRemoveRow = useCallback((rowIndex: number) => onChange(removeRow(value, rowIndex)), [onChange, value]);

  return (
    <div>
      <div className={classes.frame} ref={frameRef}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={`${classes.numberCell} ${classes.headCell} ${classes.corner}`} />
              {value.columns.map((column, columnIndex) => (
                <th key={columnIndex} className={classes.headCell}>
                  <Group gap={0} wrap="nowrap">
                    <input
                      className={classes.headInput}
                      value={column}
                      aria-label={`Название столбца ${columnIndex + 1}`}
                      onChange={(event) => onChange(setColumnName(value, columnIndex, event.currentTarget.value))}
                    />
                    <Menu position="bottom-end" withinPortal>
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          mr={4}
                          className={classes.columnMenu}
                          aria-label={`Действия со столбцом ${columnIndex + 1}`}
                        >
                          <IconDotsVertical size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconPlus size={14} />}
                          disabled={value.columns.length >= MAX_COLUMNS}
                          onClick={() => onChange(addColumn(value, columnIndex))}
                        >
                          Столбец справа
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          disabled={value.columns.length <= 1}
                          onClick={() => onChange(removeColumn(value, columnIndex))}
                        >
                          Удалить столбец
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </th>
              ))}
              <th className={`${classes.headCell} ${classes.rowActions}`} />
            </tr>
          </thead>
          <tbody>
            {value.rows.map((cells, rowIndex) => (
              <SheetRow
                key={rowIndex}
                cells={cells}
                rowIndex={rowIndex}
                onCell={handleCell}
                onPaste={handlePaste}
                onRemove={handleRemoveRow}
                onEnter={handleEnter}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Group justify="space-between" mt="xs" wrap="wrap" gap="xs">
        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            disabled={value.rows.length >= MAX_ROWS}
            onClick={() => {
              onChange(addRow(value));
              focusCell(value.rows.length, 0);
            }}
          >
            Строка
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            disabled={value.columns.length >= MAX_COLUMNS}
            onClick={() => onChange(addColumn(value))}
          >
            Столбец
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          {value.rows.length} × {value.columns.length} · вставка из Excel раскладывается по ячейкам
        </Text>
      </Group>
    </div>
  );
}
