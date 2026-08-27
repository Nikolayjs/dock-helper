import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties } from 'react';
import { ActionIcon, Button, Group, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import { IconDotsVertical, IconPlus, IconSearch, IconSortAscending, IconSortDescending, IconTrash } from '@tabler/icons-react';

import { SCROLL_ROOT_ID } from '../../components/layout/scrollRoot';
import { columnLetter, FIRST_DATA_ROW, HEADER_ROW } from '../../lib/sheet/cellRef';
import { cellAddress, evaluateGrid, isFormula } from '../../lib/sheet/formula';
import { completeFunction, formulaHint } from '../../lib/sheet/formulaHint';
import { FormulaHelp } from './FormulaHelp';
import { FormulaHintBox } from './FormulaHintBox';
import classes from './SheetEditor.module.css';
import { applyFormat, clearFormat, getFormat, normalizeRange, rangeContains } from './sheetFormat';
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
import { SheetToolbar } from './SheetToolbar';
import { useFittedHeight } from './useFittedHeight';
import type { CellFormat, DocumentSheet, SheetFormats } from './types';

interface SheetEditorProps {
  value: DocumentSheet;
  onChange: (sheet: DocumentSheet) => void;
}

interface CellAddress {
  row: number;
  column: number;
}

/** Полоса прокрутки, кнопки «Строка» и «Столбец» и отступ под ними — то, что должно остаться на виду. */
const BOTTOM_RESERVE = 88;
/**
 * Ниже этого таблица перестаёт быть таблицей — лучше прокрутить страницу, чем показать две строки.
 * Обычный пол — половина окна (см. `useFittedHeight`); это число держит совсем низкие окна.
 */
const MIN_FRAME_HEIGHT = 220;

/** Ошибка вычисления печатается красным — её видно и в потоке чисел, и в потоке текста. */
function cellClass(raw: string, shown: string): string {
  if (!isFormula(raw)) return classes.input;
  return shown.startsWith('#') ? classes.failed : classes.computed;
}

/**
 * Оформление ячейки — инлайновым стилем: у каждой оно своё, и класса на все сочетания не напасёшься.
 *
 * Заливка при этом ложится на саму ячейку, а не на её поле ввода: отметка выделения нарисована
 * внутренней тенью ячейки, и поле с непрозрачным фоном перекрыло бы её — стало бы непонятно, к чему
 * применится кнопка панели.
 */
function textStyle(format: CellFormat): CSSProperties {
  return {
    fontWeight: format.bold ? 600 : undefined,
    fontStyle: format.italic ? 'italic' : undefined,
    textAlign: format.align,
    // На залитой ячейке текст всегда тёмный, независимо от темы. Заливки светлые и в тёмной теме
    // остаются светлыми — такими же они уйдут в файл и на бумагу; светлый текст поверх них
    // пропадает. Ровно та же причина, по которой в редакторе текста тёмным набран `mark`.
    color: format.fill ? '#212529' : undefined,
  };
}

function fillStyle(format: CellFormat): CSSProperties {
  return { backgroundColor: format.fill ? `#${format.fill}` : undefined };
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
  editingColumn,
  selectedFrom,
  selectedTo,
  formats,
  hidden,
  totals,
  onCell,
  onPaste,
  onRemove,
  onEnter,
  onFocusCell,
  onCaret,
  onBlurCell,
  onSelectStart,
  onSelectExtend,
  onSelectRow,
}: {
  cells: string[];
  shown: string[];
  excelRow: number;
  editingColumn: number | null;
  selectedFrom: number;
  selectedTo: number;
  formats: SheetFormats | undefined;
  hidden?: boolean;
  totals?: boolean;
  onCell: (excelRow: number, columnIndex: number, value: string) => void;
  onPaste: (excelRow: number, columnIndex: number, text: string) => boolean;
  onRemove?: (excelRow: number) => void;
  onEnter: (excelRow: number, columnIndex: number) => void;
  onFocusCell: (address: CellAddress) => void;
  onCaret: (address: CellAddress, caret: number) => void;
  onBlurCell: () => void;
  onSelectStart: (address: CellAddress, additive: boolean) => void;
  onSelectExtend: (address: CellAddress) => void;
  onSelectRow: (excelRow: number) => void;
}) {
  return (
    <tr className={`${hidden ? classes.hidden : ''} ${totals ? classes.totalsRow : ''}`}>
      <td className={`${classes.numberCell} ${classes.pickable}`} onClick={() => onSelectRow(excelRow)} title="Выделить строку">
        {excelRow}
      </td>
      {cells.map((cell, columnIndex) => {
        // В фокусе — сама формула, вне фокуса — её результат. Так же ведёт себя Excel, и иначе
        // формулу нельзя было бы ни увидеть, ни поправить.
        const editing = editingColumn === columnIndex;
        const text = editing ? cell : (shown[columnIndex] ?? cell);
        const format = getFormat(formats, excelRow, columnIndex);
        const selected = columnIndex >= selectedFrom && columnIndex <= selectedTo;

        const shared = {
          value: text,
          style: textStyle(format),
          'data-cell': `${excelRow}:${columnIndex}`,
          'aria-label': `Строка ${excelRow}, столбец ${columnLetter(columnIndex)}`,
          onFocus: () => onFocusCell({ row: excelRow, column: columnIndex }),
          // Каретка снимается и по `select`, и по отпусканию клавиши: в Chromium `select` на
          // простой набор текста не срабатывает — только на изменение выделения, — и подсказка
          // молчала бы ровно тогда, когда она нужнее всего.
          onSelect: (event: { currentTarget: { selectionStart: number | null } }) =>
            onCaret({ row: excelRow, column: columnIndex }, event.currentTarget.selectionStart ?? 0),
          onKeyUp: (event: { currentTarget: { selectionStart: number | null } }) =>
            onCaret({ row: excelRow, column: columnIndex }, event.currentTarget.selectionStart ?? 0),
          onBlur: onBlurCell,
          onPaste: (event: ClipboardEvent) => {
            const clipboard = event.clipboardData.getData('text/plain');
            if (onPaste(excelRow, columnIndex, clipboard)) event.preventDefault();
          },
        };

        return (
          <td
            key={columnIndex}
            className={`${classes.bodyCell} ${selected ? classes.selected : ''}`}
            style={fillStyle(format)}
            onMouseDown={(event) => onSelectStart({ row: excelRow, column: columnIndex }, event.shiftKey)}
            onMouseEnter={() => onSelectExtend({ row: excelRow, column: columnIndex })}
          >
            {format.wrap ? (
              <textarea
                {...shared}
                className={classes.wrapped}
                rows={2}
                onChange={(event) => {
                  onCell(excelRow, columnIndex, event.currentTarget.value);
                  onCaret({ row: excelRow, column: columnIndex }, event.currentTarget.selectionStart ?? 0);
                }}
                // Enter уводит вниз, как в Excel; перенос внутри ячейки — Shift+Enter.
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onEnter(excelRow, columnIndex);
                  }
                }}
              />
            ) : (
              <input
                {...shared}
                className={editing ? classes.input : cellClass(cell, text)}
                onChange={(event) => {
                  onCell(excelRow, columnIndex, event.currentTarget.value);
                  onCaret({ row: excelRow, column: columnIndex }, event.currentTarget.selectionStart ?? 0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onEnter(excelRow, columnIndex);
                  }
                }}
              />
            )}
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
  /** Ячейка, с которой работает панель и строка формул; переживает уход фокуса. */
  const [active, setActive] = useState<CellAddress | null>(null);
  /**
   * Ячейка, поле которой сейчас в фокусе, и положение курсора в ней.
   *
   * Курсор нужен подсказке: `=СУММ(` и `=СУ` — разные вопросы, и различает их только то, где стоит
   * каретка. В строку таблицы уходят отдельные числа, а не этот объект, поэтому его изменение
   * ничего не перерисовывает, кроме самой подсказки.
   */
  const [editing, setEditing] = useState<(CellAddress & { caret: number }) | null>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const [head, setHead] = useState<CellAddress | null>(null);
  const dragging = useRef(false);
  const [query, setQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const frameHeight = useFittedHeight(frameRef, { reserve: BOTTOM_RESERVE, min: MIN_FRAME_HEIGHT });

  /**
   * Если под таблицу не осталось места — страница прокручивается к ней один раз, при открытии.
   *
   * Над ней название, описание, выбор пациента и теги; на невысоком окне они занимают его целиком,
   * и таблица открывается за нижним краем вместе со своей полосой прокрутки и кнопками. Считать это
   * нормальным нельзя: врач нажал «Редактировать» на таблице, а таблицы не видно. Один раз и только
   * когда действительно не помещается — дальше страница слушается обычной прокрутки.
   *
   * Прокручивается ровно на недостающее, а не `scrollIntoView({ block: 'end' })`: тот совмещает низ
   * рамки с низом окна, а под рамкой ещё кнопки «Строка» и «Столбец» и прилипшая панель «Сохранить»
   * — они остались бы за краем. И ждать приходится измеренной высоты: на первом кадре рамка ещё
   * запасной высоты из стилей, и по ней недостающее посчиталось бы не то.
   */
  const scrolledIntoView = useRef(false);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || frameHeight === null || scrolledIntoView.current) return;
    scrolledIntoView.current = true;
    const actions = document.querySelector<HTMLElement>('[data-form-actions]');
    const covered = actions ? actions.getBoundingClientRect().height : 0;
    const missing = frame.getBoundingClientRect().bottom + BOTTOM_RESERVE + covered - window.innerHeight;
    if (missing <= 0) return;
    const root = document.getElementById(SCROLL_ROOT_ID);
    (root ?? window).scrollBy({ top: missing, behavior: 'smooth' });
  }, [frameHeight]);

  const grid = useMemo(() => buildGrid(value), [value]);
  const shown = useMemo(() => evaluateGrid(grid), [grid]);
  const totalsRowNumber = value.rows.length + FIRST_DATA_ROW;
  const lastRow = value.rows.length + (value.totals ? FIRST_DATA_ROW : HEADER_ROW);

  const selection = useMemo(() => (active && head ? normalizeRange(active, head) : null), [active, head]);

  /**
   * Обработчики не должны меняться от правки таблицы.
   *
   * Иначе мемоизация строк бесполезна: новый обработчик — новый пропс у каждой строки, и все они
   * перерисовываются на каждое нажатие клавиши. Поэтому текущая таблица читается из ссылки, а сами
   * обработчики создаются один раз.
   */
  const latest = useRef({ value, onChange });
  useLayoutEffect(() => {
    latest.current = { value, onChange };
  });

  // ─── Отмена и возврат ──────────────────────────────────────────────────────
  const past = useRef<DocumentSheet[]>([]);
  const future = useRef<DocumentSheet[]>([]);
  const lastMerge = useRef<{ key: string; at: number } | null>(null);
  const [, setHistoryTick] = useState(0);

  /**
   * Любая правка проходит через `commit`: только так у отмены есть что отменять.
   *
   * Правки одной и той же ячейки подряд сливаются в один шаг. Иначе «отменить» после набранного
   * слова снимало бы по букве, и вернуться к тому, что было, стоило бы двадцати нажатий.
   */
  const commit = useCallback((next: DocumentSheet, mergeKey?: string) => {
    const { value: sheet, onChange: emit } = latest.current;
    if (next === sheet) return;

    const now = Date.now();
    const merging =
      mergeKey !== undefined &&
      lastMerge.current?.key === mergeKey &&
      now - lastMerge.current.at < 1500 &&
      past.current.length > 0;
    if (!merging) past.current = [...past.current.slice(-49), sheet];
    lastMerge.current = mergeKey === undefined ? null : { key: mergeKey, at: now };

    future.current = [];
    setHistoryTick((tick) => tick + 1);
    emit(next);
  }, []);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current = [latest.current.value, ...future.current];
    lastMerge.current = null;
    setHistoryTick((tick) => tick + 1);
    latest.current.onChange(previous);
  }, []);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, latest.current.value];
    lastMerge.current = null;
    setHistoryTick((tick) => tick + 1);
    latest.current.onChange(next);
  }, []);

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

  const writeCell = useCallback(
    (excelRow: number, columnIndex: number, cell: string) => {
      const { value: sheet } = latest.current;
      const next =
        sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW
          ? setTotalsCell(sheet, columnIndex, cell)
          : setCell(sheet, excelRow - FIRST_DATA_ROW, columnIndex, cell);
      commit(next, `cell:${excelRow}:${columnIndex}`);
    },
    [commit],
  );

  /**
   * Вставка из Excel. Кусок из одной ячейки пропускается в браузер — так работает обычная вставка
   * внутри поля, включая замену выделенной части; всё остальное раскладывается по сетке.
   */
  const handlePaste = useCallback(
    (excelRow: number, columnIndex: number, text: string) => {
      const { value: sheet } = latest.current;
      if (sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW) return false;
      if (!text.includes('\t') && !text.includes('\n')) return false;
      const parsed = parseClipboardGrid(text);
      if (parsed.length === 0) return false;
      commit(pasteInto(sheet, excelRow - FIRST_DATA_ROW, columnIndex, parsed));
      return true;
    },
    [commit],
  );

  /** Enter уводит вниз, как в Excel; на последней строке заводит новую — иначе ввод упирается в стену. */
  const handleEnter = useCallback(
    (excelRow: number, columnIndex: number) => {
      const { value: sheet } = latest.current;
      // Из строки итогов уходить некуда — она и так последняя.
      if (sheet.totals && excelRow === sheet.rows.length + FIRST_DATA_ROW) return;
      if (excelRow === sheet.rows.length + HEADER_ROW) commit(addRow(sheet));
      focusCell(excelRow + 1, columnIndex);
    },
    [commit, focusCell],
  );

  const handleRemoveRow = useCallback(
    (excelRow: number) => commit(removeRow(latest.current.value, excelRow - FIRST_DATA_ROW)),
    [commit],
  );

  const handleFocusCell = useCallback((address: CellAddress) => {
    setActive(address);
    setEditing({ ...address, caret: 0 });
    setHead((current) => current ?? address);
  }, []);

  const handleCaret = useCallback((address: CellAddress, caret: number) => {
    setEditing((current) =>
      current && current.row === address.row && current.column === address.column && current.caret === caret
        ? current
        : { ...address, caret },
    );
  }, []);

  const handleBlurCell = useCallback(() => {
    setEditing(null);
    setAnchor(null);
  }, []);

  const handleSelectStart = useCallback((address: CellAddress, additive: boolean) => {
    if (additive) setHead(address);
    else {
      setActive(address);
      setHead(address);
    }
    dragging.current = true;
  }, []);

  const handleSelectExtend = useCallback((address: CellAddress) => {
    if (dragging.current) setHead(address);
  }, []);

  const selectRow = useCallback((excelRow: number) => {
    setActive({ row: excelRow, column: 0 });
    setHead({ row: excelRow, column: latest.current.value.columns.length - 1 });
  }, []);

  const selectColumn = (columnIndex: number) => {
    setActive({ row: HEADER_ROW, column: columnIndex });
    setHead({ row: lastRow, column: columnIndex });
  };

  const removeSelectedRows = () => {
    if (!selection) return;
    let next = value;
    // Индексы съезжают при каждом удалении, поэтому строки удаляются снизу вверх.
    const from = Math.max(selection.top, FIRST_DATA_ROW);
    const to = Math.min(selection.bottom, value.rows.length + HEADER_ROW);
    for (let row = to; row >= from; row--) next = removeRow(next, row - FIRST_DATA_ROW);
    commit(next);
    setActive(null);
    setHead(null);
  };

  const removeSelectedColumns = () => {
    if (!selection) return;
    let next = value;
    for (let column = selection.right; column >= selection.left; column--) next = removeColumn(next, column);
    commit(next);
    setActive(null);
    setHead(null);
  };

  const sort = (columnIndex: number, direction: SortDirection) => commit(sortRows(value, columnIndex, direction));

  // ─── Строка формул ─────────────────────────────────────────────────────────
  const rawAt = (address: CellAddress): string => {
    if (address.row === HEADER_ROW) return value.columns[address.column] ?? '';
    if (value.totals && address.row === totalsRowNumber) return value.totals[address.column] ?? '';
    return value.rows[address.row - FIRST_DATA_ROW]?.[address.column] ?? '';
  };

  const activeRaw = active ? rawAt(active) : '';
  const editingRaw = editing ? rawAt(editing) : '';
  const hint = editing ? formulaHint(editingRaw, editing.caret) : null;

  /**
   * Куда встать подсказке: под тем полем, в котором сейчас набирают.
   *
   * Поле ищется по адресу, а если фокус в строке формул — берётся она. Пересчитывается на каждое
   * движение каретки: прокрутка таблицы между этими движениями не успевает случиться.
   */
  // Зависимости — только простые значения. От объекта `hint`, который пересоздаётся каждый рендер,
  // эффект срабатывал бы после каждой своей же перерисовки: React ловит это как «превышена глубина
  // обновления» и валит страницу.
  const hintKey = hint
    ? hint.kind === 'functions'
      ? `f:${hint.prefix}`
      : `s:${hint.doc.name}:${hint.argument}`
    : '';
  const editingRow = editing?.row ?? null;
  const editingColumnIndex = editing?.column ?? null;

  useLayoutEffect(() => {
    if (editingRow === null || editingColumnIndex === null || !hintKey) {
      setAnchor(null);
      return;
    }
    const inBar = document.activeElement === formulaBarRef.current;
    const element = inBar
      ? formulaBarRef.current
      : frameRef.current?.querySelector<HTMLElement>(`[data-cell="${editingRow}:${editingColumnIndex}"]`);
    const rect = element ? element.getBoundingClientRect() : null;
    setAnchor((previous) =>
      previous && rect && previous.left === rect.left && previous.top === rect.top && previous.width === rect.width
        ? previous
        : rect,
    );
  }, [editingRow, editingColumnIndex, hintKey]);

  /** Подставляет выбранную функцию и возвращает каретку за открывающую скобку. */
  const pickFunction = (name: string) => {
    if (!editing) return;
    const completed = completeFunction(editingRaw, editing.caret, name);
    if (editing.row === HEADER_ROW) commit(setColumnName(value, editing.column, completed.text), `head:${editing.column}`);
    else writeCell(editing.row, editing.column, completed.text);

    const target = editing;
    requestAnimationFrame(() => {
      const inBar = document.activeElement === formulaBarRef.current;
      const element = inBar
        ? formulaBarRef.current
        : frameRef.current?.querySelector<HTMLInputElement>(`[data-cell="${target.row}:${target.column}"]`);
      element?.setSelectionRange(completed.caret, completed.caret);
      setEditing({ ...target, caret: completed.caret });
    });
  };
  const activeShown = active ? (shown[active.row - 1]?.[active.column] ?? '') : '';

  const writeActive = (text: string) => {
    if (!active) return;
    if (active.row === HEADER_ROW) commit(setColumnName(value, active.column, text), `head:${active.column}`);
    else writeCell(active.row, active.column, text);
  };

  return (
    <div
      onMouseUp={() => {
        dragging.current = false;
      }}
      onMouseLeave={() => {
        dragging.current = false;
      }}
    >
      <SheetToolbar
        formats={value.formats ?? undefined}
        range={selection}
        hasTotals={Boolean(value.totals)}
        canUndo={past.current.length > 0}
        canRedo={future.current.length > 0}
        onFormat={(patch) => selection && commit(applyFormat(value, selection, patch))}
        onClearFormat={() => selection && commit(clearFormat(value, selection))}
        onUndo={undo}
        onRedo={redo}
        onAddRow={() => commit(addRow(value))}
        onRemoveRows={removeSelectedRows}
        onAddColumn={() => commit(addColumn(value, selection?.right))}
        onRemoveColumns={removeSelectedColumns}
        onToggleTotals={() => commit(value.totals ? removeTotalsRow(value) : addTotalsRow(value))}
        onHelp={() => setHelpOpen(true)}
      />

      {/* Строка формул: адрес ячейки и её содержимое целиком. Длинная формула в самой ячейке
          обрезается краем столбца — здесь она видна и правится. */}
      <Group gap="xs" mb="xs" wrap="nowrap" align="center">
        <Text size="xs" fw={600} c="dimmed" w={44} ta="center" style={{ flexShrink: 0 }}>
          {active ? cellAddress(active.row, active.column) : '—'}
        </Text>
        <TextInput
          ref={formulaBarRef}
          size="xs"
          style={{ flex: 1 }}
          disabled={!active}
          aria-label="Строка формул"
          placeholder={active ? 'Значение или формула' : 'Выберите ячейку'}
          value={activeRaw}
          onFocus={() => active && setEditing({ ...active, caret: activeRaw.length })}
          onSelect={(event) => active && handleCaret(active, event.currentTarget.selectionStart ?? 0)}
          onKeyUp={(event) => active && handleCaret(active, event.currentTarget.selectionStart ?? 0)}
          onBlur={handleBlurCell}
          onChange={(event) => {
            writeActive(event.currentTarget.value);
            if (active) handleCaret(active, event.currentTarget.selectionStart ?? 0);
          }}
        />
        {active && isFormula(activeRaw) && (
          <Text size="xs" c={activeShown.startsWith('#') ? 'red' : 'dimmed'} style={{ flexShrink: 0 }}>
            = {activeShown}
          </Text>
        )}
        <TextInput
          size="xs"
          w={190}
          placeholder="Поиск по таблице…"
          leftSection={<IconSearch size={14} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={{ flexShrink: 0 }}
        />
      </Group>

      <div className={classes.frame} ref={frameRef} style={{ maxHeight: frameHeight ?? undefined }}>
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={`${classes.numberCell} ${classes.headCell} ${classes.corner}`}>{HEADER_ROW}</th>
              {value.columns.map((column, columnIndex) => {
                const selected = selection ? rangeContains(selection, HEADER_ROW, columnIndex) : false;
                const format = getFormat(value.formats ?? undefined, HEADER_ROW, columnIndex);
                return (
                  <th
                    key={columnIndex}
                    className={`${classes.headCell} ${selected ? classes.selected : ''}`}
                    style={fillStyle(format)}
                    // Без этого протягивание, начатое в шапке, не доходило до соседних столбцов:
                    // выделялась одна ячейка, и панель красила только её.
                    onMouseEnter={() => handleSelectExtend({ row: HEADER_ROW, column: columnIndex })}
                  >
                    <Group gap={0} wrap="nowrap">
                      <span
                        className={`${classes.columnLetter} ${classes.pickable}`}
                        onClick={() => selectColumn(columnIndex)}
                        title="Выделить столбец"
                      >
                        {columnLetter(columnIndex)}
                      </span>
                      <input
                        className={classes.headInput}
                        style={textStyle(format)}
                        value={column}
                        data-cell={`${HEADER_ROW}:${columnIndex}`}
                        aria-label={`Название столбца ${columnLetter(columnIndex)}`}
                        onFocus={() => handleFocusCell({ row: HEADER_ROW, column: columnIndex })}
                        onSelect={(event) => handleCaret({ row: HEADER_ROW, column: columnIndex }, event.currentTarget.selectionStart ?? 0)}
                        onBlur={handleBlurCell}
                        onMouseDown={(event) => handleSelectStart({ row: HEADER_ROW, column: columnIndex }, event.shiftKey)}
                        onChange={(event) => commit(setColumnName(value, columnIndex, event.currentTarget.value), `head:${columnIndex}`)}
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
                            onClick={() => commit(addColumn(value, columnIndex))}
                          >
                            Столбец справа
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            disabled={value.columns.length <= 1}
                            onClick={() => commit(removeColumn(value, columnIndex))}
                          >
                            Удалить столбец
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </th>
                );
              })}
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
                  editingColumn={editing?.row === excelRow ? editing.column : null}
                  selectedFrom={selection && excelRow >= selection.top && excelRow <= selection.bottom ? selection.left : -1}
                  selectedTo={selection && excelRow >= selection.top && excelRow <= selection.bottom ? selection.right : -1}
                  formats={value.formats ?? undefined}
                  hidden={visible ? !visible.has(index) : false}
                  onCell={writeCell}
                  onPaste={handlePaste}
                  onRemove={handleRemoveRow}
                  onEnter={handleEnter}
                  onFocusCell={handleFocusCell}
                  onCaret={handleCaret}
                  onBlurCell={handleBlurCell}
                  onSelectStart={handleSelectStart}
                  onSelectExtend={handleSelectExtend}
                  onSelectRow={selectRow}
                />
              );
            })}
            {value.totals && (
              <SheetRow
                cells={value.totals}
                shown={shown[value.rows.length + 1] ?? value.totals}
                excelRow={totalsRowNumber}
                editingColumn={editing?.row === totalsRowNumber ? editing.column : null}
                selectedFrom={
                  selection && totalsRowNumber >= selection.top && totalsRowNumber <= selection.bottom ? selection.left : -1
                }
                selectedTo={
                  selection && totalsRowNumber >= selection.top && totalsRowNumber <= selection.bottom ? selection.right : -1
                }
                formats={value.formats ?? undefined}
                totals
                onCell={writeCell}
                onPaste={handlePaste}
                onEnter={handleEnter}
                onFocusCell={handleFocusCell}
                onCaret={handleCaret}
                onBlurCell={handleBlurCell}
                onSelectStart={handleSelectStart}
                onSelectExtend={handleSelectExtend}
                onSelectRow={selectRow}
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
              commit(addRow(value));
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
            onClick={() => commit(addColumn(value))}
          >
            Столбец
          </Button>
        </Group>
        <Text size="xs" c="dimmed" ta="right">
          {visible ? `Показано ${visible.size} из ${value.rows.length}` : `${value.rows.length} × ${value.columns.length}`}
          {selection && (selection.top !== selection.bottom || selection.left !== selection.right)
            ? ` · выделено ${(selection.bottom - selection.top + 1) * (selection.right - selection.left + 1)} ячеек`
            : ''}{' '}
          ·{' '}
          <Tooltip label="Открыть справку" withArrow>
            <Text span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={() => setHelpOpen(true)}>
              формулы
            </Text>
          </Tooltip>{' '}
          начинаются со знака{' '}
          <Text span ff="monospace">
            =
          </Text>
        </Text>
      </Group>

      {hint && anchor && <FormulaHintBox hint={hint} anchor={anchor} onPick={pickFunction} />}

      <FormulaHelp opened={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
