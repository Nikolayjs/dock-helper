import { ActionIcon, Badge, Stack, Text, Tooltip } from '@mantine/core';
import { IconChevronRight, IconStar, IconStarFilled } from '@tabler/icons-react';

import type { ReactNode } from 'react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import type { CalculatorDefinition } from './types';
import classes from '../drugs/DrugList.module.css';

/**
 * Калькуляторы списком, а не плитками.
 *
 * Плитка оправдана там, где в превью может оказаться картинка — статья, новость, книга. У
 * калькулятора превью — это название, одна строка описания и раздел: три коротких поля, ради
 * которых плитка занимает треть ширины экрана и заставляет читать список зигзагом. Строка ставит
 * их в колонки, и тридцать калькуляторов просматриваются одним движением глаз сверху вниз.
 */
export type CalculatorSortKey = 'title' | 'category' | 'favourite';

export const CALCULATOR_SORT_KEYS: readonly CalculatorSortKey[] = ['title', 'category', 'favourite'];

export function calculatorSortValue(calc: CalculatorDefinition, key: CalculatorSortKey): SortValue {
  switch (key) {
    case 'title':
      return calc.title.toLowerCase();
    case 'category':
      return calc.category;
    case 'favourite':
      // Избранные вперёд: звёздочку ставят, чтобы найти калькулятор быстрее, а не чтобы отметить.
      return calc.favourite ? 0 : 1;
  }
}

interface Props {
  calculators: CalculatorDefinition[];
  sort: SortState<CalculatorSortKey>;
  onSort: (key: CalculatorSortKey) => void;
  onOpen: (calc: CalculatorDefinition) => void;
  onToggleFavourite: (calc: CalculatorDefinition) => void;
  categoryColor: (category: string) => string;
  narrow: boolean;
}

export function CalculatorTable({
  calculators,
  sort,
  onSort,
  onOpen,
  onToggleFavourite,
  categoryColor,
  narrow,
}: Props) {
  const star = (calc: CalculatorDefinition) => (
    <Tooltip label={calc.favourite ? 'Убрать из избранного' : 'В избранное'} withArrow>
      <ActionIcon
        variant="subtle"
        color={calc.favourite ? 'yellow' : 'gray'}
        onClick={() => onToggleFavourite(calc)}
        aria-label={calc.favourite ? `Убрать из избранного: ${calc.title}` : `В избранное: ${calc.title}`}
      >
        {calc.favourite ? <IconStarFilled size={16} /> : <IconStar size={16} />}
      </ActionIcon>
    </Tooltip>
  );

  if (narrow) return <CalculatorList calculators={calculators} onOpen={onOpen} star={star} />;

  const columns: DataColumn<CalculatorDefinition, CalculatorSortKey>[] = [
    {
      key: 'favourite',
      header: '',
      w: 56,
      stopClick: true,
      render: star,
    },
    {
      key: 'title',
      header: 'Калькулятор',
      miw: 360,
      render: (calc) => (
        <>
          <Text size="sm" fw={600}>
            {calc.title}
          </Text>
          {calc.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {calc.description}
            </Text>
          )}
        </>
      ),
    },
    {
      key: 'category',
      header: 'Раздел',
      w: 240,
      render: (calc) => (
        <Badge size="sm" variant="light" color={categoryColor(calc.category)} tt="none">
          {calc.category}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      rows={calculators}
      columns={columns}
      rowKey={(calc) => calc.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={720}
    />
  );
}

/** Компактный список на телефоне — стили общие со справочником препаратов. */
function CalculatorList({
  calculators,
  onOpen,
  star,
}: {
  calculators: CalculatorDefinition[];
  onOpen: (calc: CalculatorDefinition) => void;
  star: (calc: CalculatorDefinition) => ReactNode;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(calculators, 40);

  return (
    <Stack gap={0}>
      {visible.map((calc) => (
        <div key={calc.id} className={classes.row}>
          {star(calc)}
          <button
            type="button"
            className={classes.main}
            onClick={() => onOpen(calc)}
            style={{ background: 'none', border: 0, textAlign: 'left' }}
          >
            <Text size="sm" fw={600}>
              {calc.title}
            </Text>
            {calc.description && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {calc.description}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {calc.category}
            </Text>
          </button>
          <IconChevronRight size={16} className={classes.chevron} />
        </div>
      ))}
      {hasMore && (
        <div ref={setSentinel} className={classes.sentinel}>
          <Text size="xs" c="dimmed">
            Загружается ещё… осталось {remaining}
          </Text>
        </div>
      )}
    </Stack>
  );
}
