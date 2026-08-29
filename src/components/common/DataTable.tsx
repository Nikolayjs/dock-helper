import type { ReactNode } from 'react';
import { Table } from '@mantine/core';

import { SortableTh } from './SortableTh';
import { useIncrementalList } from '../../lib/useIncrementalList';
import type { SortState } from '../../lib/tableSort';

/**
 * Список записей таблицей: шапка с сортировкой, строки порциями, нажатие по строке.
 *
 * Семь таблиц повторяли этот каркас слово в слово. Нижние уровни — `SortableTh`, `useTableSort` с
 * тестами, `useIncrementalList` — уже были общими; не хватало верхнего, и из-за этого порционная
 * отрисовка приезжала в каждую таблицу отдельно и не во все сразу.
 *
 * **Отбор и сортировка остаются снаружи, у страницы.** Таблица получает готовый набор и только
 * рисует его: иначе она знала бы и про фильтры пациентов, и про счётчики взаимодействий, и про
 * разрешение кодов МКБ — то есть перестала бы быть общей на второй же таблице.
 */
export interface DataColumn<Row, K extends string> {
  /** Ключ сортировки. Без него столбец не сортируется — так объявляется колонка кнопок. */
  key?: K;
  header?: ReactNode;
  render: (row: Row) => ReactNode;
  /** Жёсткая ширина, как `w` у обычной ячейки. */
  w?: number;
  /** Нижняя граница для столбца, который не должен ужиматься соседями с жёсткой шириной. */
  miw?: number;
  /**
   * Нажатие внутри ячейки до строки не доходит.
   *
   * Нужно колонке с кнопками: строка сама открывает запись, и «Удалить» не должно попутно
   * открывать её же.
   */
  stopClick?: boolean;
}

interface DataTableProps<Row, K extends string> {
  rows: readonly Row[];
  columns: DataColumn<Row, K>[];
  rowKey: (row: Row) => string;
  sort: SortState<K>;
  onSort: (key: K) => void;
  onRowClick?: (row: Row) => void;
  /** Ниже этой ширины столбцы давятся, а не переносятся — таблица уезжает вбок внутри своей рамки. */
  minWidth: number;
  /** Размер порции отрисовки. */
  step?: number;
}

export function DataTable<Row, K extends string>({
  rows,
  columns,
  rowKey,
  sort,
  onSort,
  onRowClick,
  minWidth,
  step,
}: DataTableProps<Row, K>) {
  // Отбор и сортировка идут по всему набору — порционно только рисуется.
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows, step);

  return (
    <Table.ScrollContainer minWidth={minWidth}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            {columns.map((column, index) =>
              column.key ? (
                <SortableTh key={column.key} column={column.key} sort={sort} onSort={onSort} w={column.w} miw={column.miw}>
                  {column.header}
                </SortableTh>
              ) : (
                <Table.Th key={`plain-${index}`} w={column.w} miw={column.miw}>
                  {column.header}
                </Table.Th>
              ),
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visible.map((row) => (
            <Table.Tr
              key={rowKey(row)}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column, index) => (
                <Table.Td
                  key={column.key ?? `plain-${index}`}
                  onClick={column.stopClick ? (event) => event.stopPropagation() : undefined}
                >
                  {column.render(row)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
          {hasMore && (
            <Table.Tr ref={setSentinel}>
              <Table.Td colSpan={columns.length} ta="center" c="dimmed" fz="xs" py="md">
                Загружается ещё… осталось {remaining}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
