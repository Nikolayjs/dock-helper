import { ActionIcon, Badge, Group, Text } from '@mantine/core';
import { IconChevronRight, IconNotes } from '@tabler/icons-react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { Icd10Row } from './types';

/**
 * Классификация: рубрики и раскрытые под ними подрубрики.
 *
 * Подрубрика отличается от рубрики отступом и приглушённым кодом, а не отдельным столбцом: столбец
 * «уровень» занял бы место и потребовал бы читать его, тогда как отступ читается сам. Идёт она
 * всегда следом за своей рубрикой — при любой сортировке.
 *
 * **Щелчок по рубрике её раскрывает.** Список, внутри которого ещё есть данные, обязан
 * раскрываться нажатием на себя — этого ждут, и попадание в значок 20 px пальцем задачей врача не
 * является. Карточка кода открывается стрелкой справа, у неё же и живёт справка по кодированию.
 * Конечный код раскрывать нечем, поэтому щелчок по нему сразу открывает карточку.
 *
 * Обе стрелки объявлены `stopClick` — нажатие на них до строки не доходит — и обе остаются
 * кнопками: щелчок по `tr` с клавиатуры недостижим, и без них раздел нельзя было бы пройти
 * табуляцией вовсе.
 */
export type Icd10SortKey = 'code' | 'name' | 'chapter' | 'block' | 'children';

export const ICD10_SORT_KEYS: readonly Icd10SortKey[] = ['code', 'name', 'chapter', 'block', 'children'];

/** Римские номера сортируются как числа: иначе класс XXI встаёт между II и III. */
const ROMAN_ORDER = new Map(
  ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI','XXII'].map(
    (roman, index) => [roman, index + 1],
  ),
);

export function icd10SortValue(row: Icd10Row, key: Icd10SortKey): SortValue {
  switch (key) {
    case 'code':
      return row.code;
    case 'name':
      return row.name;
    case 'chapter':
      return ROMAN_ORDER.get(row.chapter) ?? 99;
    case 'block':
      return row.blockRange;
    case 'children':
      return row.children || null;
  }
}

interface Icd10TableProps {
  rows: Icd10Row[];
  sort: SortState<Icd10SortKey>;
  onSort: (key: Icd10SortKey) => void;
  onOpen: (row: Icd10Row) => void;
  onToggle: (code: string) => void;
  /** Щелчок по строке: рубрику с уточнениями раскрывает, всё прочее открывает. */
  onRowClick: (row: Icd10Row) => void;
}

export function Icd10Table({ rows, sort, onSort, onOpen, onToggle, onRowClick }: Icd10TableProps) {
  const columns: DataColumn<Icd10Row, Icd10SortKey>[] = [
    {
      // Место под стрелку занято всегда, даже у конечного кода: ширина столбца меряется по
      // содержимому, и значок, появляющийся из ниоткуда, раздвигал бы таблицу при раскрытии.
      w: 44,
      stopClick: true,
      render: (row) =>
        row.depth === 0 && row.children > 0 ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onToggle(row.code)}
            aria-label={row.expanded ? `Свернуть подрубрики ${row.code}` : `Раскрыть подрубрики ${row.code}`}
            aria-expanded={row.expanded}
          >
            <IconChevronRight
              size={16}
              style={{ transform: row.expanded ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }}
            />
          </ActionIcon>
        ) : null,
    },
    {
      key: 'code',
      header: 'Код',
      w: 128,
      render: (row) => (
        <Text
          fw={row.depth === 0 ? 600 : 400}
          size="sm"
          ff="monospace"
          c={row.depth === 0 ? undefined : 'dimmed'}
          pl={row.depth === 0 ? 0 : 20}
        >
          {row.code}
        </Text>
      ),
    },
    {
      key: 'name',
      header: 'Наименование',
      miw: 320,
      render: (row) => (
        <Group gap={8} wrap="nowrap" pl={row.depth === 0 ? 0 : 20}>
          <Text size="sm" lineClamp={2} c={row.depth === 0 ? undefined : 'dimmed'}>
            {row.name}
          </Text>
          {/* Отметка о справке — единственное, что отличает строки друг от друга по содержанию,
              и по ней же врач фильтрует список. */}
          {row.hasNote && (
            <IconNotes size={14} style={{ flexShrink: 0, opacity: 0.5 }} aria-label="Есть справка" />
          )}
        </Group>
      ),
    },
    // Класс и блок у подрубрики те же, что у её рубрики строкой выше — а она всегда строкой выше,
    // при любой сортировке. Повторять их на каждой из 12 587 подрубрик значило бы заполнить
    // половину таблицы уже прочитанным.
    {
      key: 'chapter',
      header: 'Класс',
      w: 88,
      render: (row) =>
        row.depth === 0 ? (
          <Badge variant="light" color="gray" size="sm" tt="none">
            {row.chapter}
          </Badge>
        ) : null,
    },
    {
      key: 'block',
      header: 'Блок',
      miw: 240,
      render: (row) =>
        row.depth === 0 ? (
          <>
            <Text size="sm" ff="monospace">
              {row.blockRange}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {row.blockName}
            </Text>
          </>
        ) : null,
    },
    {
      key: 'children',
      header: 'Подрубрик',
      w: 120,
      // Столбец отвечает на вопрос «можно ли ставить этот код в диагноз»: рубрика с подрубриками
      // нельзя, без них — можно. У подрубрики ответ всегда «можно», и повторять это 12 587 раз
      // значило бы забить столбец одним словом; что строка — подрубрика, видно по отступу.
      render: (row) =>
        row.depth === 1 ? null : row.children > 0 ? (
          <Text size="sm">{row.children}</Text>
        ) : (
          <Text size="sm" c="dimmed">
            конечный
          </Text>
        ),
    },
    {
      // Открыть карточку. У рубрики с уточнениями это единственный путь к ней: щелчок по строке
      // занят раскрытием. Столбец стоит у всех строк, а не только у раскрываемых: одно и то же
      // действие обязано жить в одном и том же месте строки.
      w: 48,
      stopClick: true,
      render: (row) => (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => onOpen(row)}
          aria-label={`Открыть карточку ${row.code}`}
        >
          <IconChevronRight size={16} />
        </ActionIcon>
      ),
    },
  ];

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.code}
      sort={sort}
      onSort={onSort}
      onRowClick={onRowClick}
      minWidth={900}
    />
  );
}
