import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Button, Group, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import {
  IconDotsVertical,
  IconPlus,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconSum,
  IconTrash,
} from '@tabler/icons-react';

import { columnLetter, FIRST_DATA_ROW, HEADER_ROW } from '../../lib/sheet/cellRef';
import { evaluateGrid, isFormula } from '../../lib/sheet/formula';
import classes from './SheetEditor.module.css';
import {
  addColumn,
  addRow,
  addTotalsRow,
  buildGrid,
  MAX_COLUMNS,
  MAX_ROWS,
  parseClipboardGrid,
  pasteInto,
  removeColumn,
  removeRow,
  removeTotalsRow,
  setCell,
  setColumnName,
  setTotalsCell,
  sortRows,
  type SortDirection,
} from './sheetOps';
import type { DocumentSheet } from './types';

interface SheetEditorProps {
  value: DocumentSheet;
  onChange: (sheet: DocumentSheet) => void;
}

/** Ошибка вычисления печатается красным — её видно и в потоке чисел, и в потоке текста. */
function cellClass(raw: string, shown: string): string {
  if (!isFormula(raw)) return classes.input;
  return shown.startsWith('#') ? classes.failed : classes.computed;
}

/**
 * Строка таблицы, мемоизированная по своим данным.
 *
 * Реестр на двести строк — это тысяча полей ввода. Без мемоизации каждое нажатие клавиши
 * перерисовывало бы их все, и печать в дальней ячейке начинала бы заметно отставать. Операции в
 * `sheetOps` и `evaluateGrid` для того и возвращают прежние ссылки на нетронутые строки.
 */
const SheetRow = memo(function SheetRow({
  cells,
  shown,
  excelRow,
  focusedColumn,
  hidden,
  totals,
  onCell,
  onPaste,
  onRemove,
  onEnter,
  onFocusCell,
  onBlurCell,
}: {
  cells: string[];
  shown: string[];
  excelRow: number;
  focusedColumn: number | null;
  hidden?: boolean;
  totals?: boolean;
  onCell: (excelRow: number, columnIndex: number, value: string) => void;
  onPaste: (excelRow: number, columnIndex: number, text: string) => boolean;
  onRemove?: (excelRow: number) => void;
  onEnter: (excelRow: number, columnIndex: number) => void;
  onFocusCell: (excelRow: number, columnIndex: number) => void;
  onBlurCell: () => void;
}) {
  return (
    <tr className={`${hidden ? classes.hidden : ''} ${totals ? classes.totalsRow : ''}`}>
      <td className={classes.numberCell}>{excelRow}</td>
      {cells.map((cell, columnIndex) => {
        // В фокусе — сама формула, вне фокуса — её результат. Так же ведёт себя Excel, и иначе
        // формулу нельзя было бы ни увидеть, ни поправить.
        const editing = focusedColumn === columnIndex;
        const text = editing ? cell : shown[columnIndex] ?? cell;
        return (
          <td key={columnIndex} className={classes.bodyCell}>
            <input
              className={editing ? classes.input : cellClass(cell, text)}
              value={text}
              data-cell={`${excelRow}:${columnIndex}`}
              aria-label={`Строка ${excelRow}, столбец ${columnLetter(columnIndex)}`}
              onFocus={() => onFocusCell(excelRow, columnIndex)}
              onBlur={onBlurCell}
              onChange={(event) => onCell(excelRow, columnIndex, event.currentTarget.value)}
              onPaste={(event) => {
                const clipboard = event.clipboardData.getData('text/plain');
                if (onPaste(excelRow, columnIndex, clipboard)) event.preventDefault();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnter(excelRow, columnIndex);
                }
              }}
            />
          </td>
        );
      })}
      <td className={classes.rowActions}>
        {onRemove && (
          <ActionIcon variant="subtle" color="red" size="sm" aria-label={`Удалить строку ${excelRow}`} onClick={() => onRemove(excelRow)}>
            <IconTrash size={14} />
          </ActionIcon>
        )}
      </td>
    </tr>
  );
});

/**
 * Сетка ячеек: строка заголовков и строки значений.
 *
 * Нумерация строк и букв столбцов — экселевская, и это не украшение: формулы адресуют ячейки именно
 * так, и то, что врач печатает здесь, попадает в файл дословно. Заголовки — строка 1, первая строка
 * данных — вторая.
 *
 * Значения ячеек хранятся строками. Таблица здесь бумага, а не расчёт: врач пишет «12.09» и «до 3
 * дней», и попытка угадать тип превратила бы одно в дату, а второе оставила текстом. Числом ячейка
 * становится в двух местах и по одному осторожному правилу — при вычислении формул и при выгрузке.
 */
export function SheetEditor({ value, onChange }: SheetEditorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<{ row: number; column: number } | null>(null);
  const [query, setQuery] = useState('');

  const grid = useMemo(() => buildGrid(value), [value]);
  const shown = useMemo(() => evaluateGrid(grid), [grid]);

  const totalsRowNumber = value.rows.length + FIRST_DATA_ROW;

  /**
   * Обработчики не должны меняться от правки таблицы.
   *
   * Иначе мемоизация строк бесполезна: новый обработчик — новый пропс у каждой строки, и все они
   * перерисовываются на каждое нажатие клавиши. Поэтому текущая таблица читается из ссылки, а сами
   * обработчики создаются один раз.
   */
  const latest = useRef({ value, onChange });
  // Обновляется в эффекте, а не прямо в рендере: рендер в React 19 может быть отброшен, а
  // обработчики всё равно срабатывают только после фиксации.
  useLayoutEffect(() => {
    latest.current = { value, onChange };
  });

  /**
   * Поиск прячет строки, но **не меняет их номера**: номера здесь абсолютные, формулы ссылаются
   * именно на них, и перенумеровать оставшиеся значило бы показать одно, а посчитать другое.
   */
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return null;
    return new Set(
      value.rows
        .map((_, index) => index)
        .filter((index) => (shown[index + 1] ?? []).some((cell) => cell.toLowerCase().includes(needle))),
    );
  }, [needle, shown, value.rows]);

  const focusCell = useCallback((excelRow: number, columnIndex: number) => {
    // В следующем кадре: строка, добавленная тем же нажатием, ещё не появилась в DOM.
    requestAnimationFrame(() => {
      frameRef.current?.querySelector<HTMLInputElement>(`[data-cell="${excelRow}:${columnIndex}"]`)?.focus();
    });
  }, []);

  const handleCell = useCallback((excelRow: number, columnIndex: number, cell: string) => {
    const { value: sheet, onChange: emit } = latest.current;
    if (sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW) emit(setTotalsCell(sheet, columnIndex, cell));
    else emit(setCell(sheet, excelRow - FIRST_DATA_ROW, columnIndex, cell));
  }, []);

  /**
   * Вставка из Excel. Кусок из одной ячейки пропускается в браузер — так работает обычная вставка
   * внутри поля, включая замену выделенной части; всё остальное раскладывается по сетке.
   */
  const handlePaste = useCallback((excelRow: number, columnIndex: number, text: string) => {
    const { value: sheet, onChange: emit } = latest.current;
    if (sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW) return false;
    if (!text.includes('\t') && !text.includes('\n')) return false;
    const parsed = parseClipboardGrid(text);
    if (parsed.length === 0) return false;
    emit(pasteInto(sheet, excelRow - FIRST_DATA_ROW, columnIndex, parsed));
    return true;
  }, []);

  /** Enter уводит вниз, как в Excel; на последней строке заводит новую — иначе ввод упирается в стену. */
  const handleEnter = useCallback(
    (excelRow: number, columnIndex: number) => {
      const { value: sheet, onChange: emit } = latest.current;
      // Из строки итогов уходить некуда — она и так последняя.
      if (sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW) return;
      if (excelRow === sheet.rows.length + HEADER_ROW) emit(addRow(sheet));
      focusCell(excelRow + 1, columnIndex);
    },
    [focusCell],
  );

  const handleRemoveRow = useCallback((excelRow: number) => {
    const { value: sheet, onChange: emit } = latest.current;
    emit(removeRow(sheet, excelRow - FIRST_DATA_ROW));
  }, []);

  const handleFocusCell = useCallback((row: number, column: number) => setFocused({ row, column }), []);
  const handleBlurCell = useCallback(() => setFocused(null), []);

  const sort = (columnIndex: number, direction: SortDirection) => onChange(sortRows(value, columnIndex, direction));

  return (
    <div>
      <Group justify="space-between" mb="xs" wrap="wrap" gap="xs">
        <TextInput
          size="xs"
          w={220}
          placeholder="Поиск по таблице…"
          leftSection={<IconSearch size={14} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <Group gap="xs">
          {value.totals ? (
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconSum size={14} />} onClick={() => onChange(removeTotalsRow(value))}>
              Убрать итоги
            </Button>
          ) : (
            <Tooltip label="Суммирует числовые столбцы" position="top" withArrow>
              <Button size="compact-xs" variant="light" leftSection={<IconSum size={14} />} onClick={() => onChange(addTotalsRow(value))}>
                Строка итогов
              </Button>
            </Tooltip>
          )}
        </Group>
      </Group>

      <div className={classes.frame} ref={frameRef}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={`${classes.numberCell} ${classes.headCell} ${classes.corner}`}>{HEADER_ROW}</th>
              {value.columns.map((column, columnIndex) => (
                <th key={columnIndex} className={classes.headCell}>
                  <Group gap={0} wrap="nowrap">
                    <span className={classes.columnLetter}>{columnLetter(columnIndex)}</span>
                    <input
                      className={classes.headInput}
                      value={column}
                      aria-label={`Название столбца ${columnLetter(columnIndex)}`}
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
                          aria-label={`Действия со столбцом ${columnLetter(columnIndex)}`}
                        >
                          <IconDotsVertical size={14} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item leftSection={<IconSortAscending size={14} />} onClick={() => sort(columnIndex, 'asc')}>
                          Сортировать по возрастанию
                        </Menu.Item>
                        <Menu.Item leftSection={<IconSortDescending size={14} />} onClick={() => sort(columnIndex, 'desc')}>
                          Сортировать по убыванию
                        </Menu.Item>
                        <Menu.Divider />
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
            {value.rows.map((cells, index) => {
              const excelRow = index + FIRST_DATA_ROW;
              return (
                <SheetRow
                  key={index}
                  cells={cells}
                  shown={shown[index + 1] ?? cells}
                  excelRow={excelRow}
                  focusedColumn={focused?.row === excelRow ? focused.column : null}
                  hidden={visible ? !visible.has(index) : false}
                  onCell={handleCell}
                  onPaste={handlePaste}
                  onRemove={handleRemoveRow}
                  onEnter={handleEnter}
                  onFocusCell={handleFocusCell}
                  onBlurCell={handleBlurCell}
                />
              );
            })}
            {value.totals && (
              <SheetRow
                cells={value.totals}
                shown={shown[value.rows.length + 1] ?? value.totals}
                excelRow={totalsRowNumber}
                focusedColumn={focused?.row === totalsRowNumber ? focused.column : null}
                totals
                onCell={handleCell}
                onPaste={handlePaste}
                onEnter={handleEnter}
                onFocusCell={handleFocusCell}
                onBlurCell={handleBlurCell}
              />
            )}
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
              focusCell(value.rows.length + FIRST_DATA_ROW, 0);
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
        <Text size="xs" c="dimmed" ta="right">
          {visible ? `Показано ${visible.size} из ${value.rows.length}` : `${value.rows.length} × ${value.columns.length}`} ·
          формула начинается со знака <Text span ff="monospace">=</Text>, например{' '}
          <Text span ff="monospace">=СУММ(B2:B10)</Text>
        </Text>
      </Group>
    </div>
  );
}
