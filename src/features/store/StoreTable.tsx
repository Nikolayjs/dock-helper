import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import { IconCheck, IconDownload } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { installedPath, type StoreItem, type StoreKind } from './useStore';
import classes from '../drugs/DrugList.module.css';

/**
 * Витрина магазина таблицей.
 *
 * **Это смена прежнего решения, и прежнее было записано с обоснованием.** Магазин показывался
 * карточками как осознанное отступление от правила «Плитка или строка»: читают-де описание в
 * три-четыре строки прозы, а в колонку такой текст не помещается. Довод оказался слабее двух
 * других: позиций стало **132**, и сетка из трёх карточек в ряд — это сорок четыре ряда, которые
 * просматриваются зигзагом; а раздел, устроенный не так, как все остальные списки приложения,
 * заставляет заново искать глазами и поиск, и кнопку.
 *
 * Описание при этом **не выброшено и не сжато до одной строки** — оно стоит второй строкой под
 * названием и обрезается на двух (`lineClamp={2}`), ровно как у калькуляторов и документов. Это и
 * был единственный настоящий довод за карточки, и он закрыт: колонка названия получает минимум
 * 360 px, и две строки описания в неё помещаются целиком.
 */
export type StoreSortKey = 'title' | 'kind' | 'status';

export const STORE_SORT_KEYS: readonly StoreSortKey[] = ['title', 'kind', 'status'];

const KIND_LABEL: Record<StoreKind, string> = {
  analyzer: 'Анализатор',
  calculator: 'Калькулятор',
  questionnaire: 'Диагностика',
  template: 'Бланк',
  book: 'Источник',
};

const KIND_COLOR: Record<StoreKind, string> = {
  analyzer: 'grape',
  calculator: 'blue',
  questionnaire: 'teal',
  template: 'orange',
  book: 'indigo',
};

export function storeSortValue(item: StoreItem, key: StoreSortKey): SortValue {
  switch (key) {
    case 'title':
      return item.title.toLowerCase();
    case 'kind':
      return KIND_LABEL[item.kind];
    case 'status':
      /*
       * Неустановленное вперёд, и это не описка.
       *
       * У калькуляторов звёздочка сортирует избранное наверх, потому что её ставят, чтобы находить
       * быстрее. Здесь вопрос обратный: в магазин приходят за тем, чего **ещё нет**, и список,
       * начинающийся с уже установленного, отвечает не на него.
       */
      return item.installed ? 1 : 0;
  }
}

interface Props {
  items: StoreItem[];
  sort: SortState<StoreSortKey>;
  onSort: (key: StoreSortKey) => void;
  onInstall: (item: StoreItem) => void;
  installingKey?: string;
  narrow: boolean;
}

export function StoreTable({ items, sort, onSort, onInstall, installingKey, narrow }: Props) {
  /**
   * Кнопка действия — она же единственный способ открыть позицию.
   *
   * Нажатия по строке здесь нет намеренно. В остальных таблицах строка открывает запись, но у
   * половины строк магазина открывать нечего: позиция не установлена. Строка, которая срабатывает
   * через раз, хуже неподвижной — это то же правило, по которому в меню не заводят пункт, иногда
   * не делающий ничего. До кнопки при этом добираются табуляцией, так что без мыши раздел работает.
   */
  const action = (item: StoreItem) =>
    item.installed ? (
      <Button component={Link} to={installedPath(item)} variant="light" size="xs">
        Открыть
      </Button>
    ) : (
      <Button
        size="xs"
        leftSection={<IconDownload size={14} />}
        loading={installingKey === item.key}
        onClick={() => onInstall(item)}
      >
        Установить
      </Button>
    );

  const status = (item: StoreItem) => (
    <Group gap="xs" wrap="nowrap">
      {item.installed && (
        <Badge size="sm" variant="light" color="teal" leftSection={<IconCheck size={12} />}>
          Установлено
        </Badge>
      )}
      {item.price > 0 && (
        <Badge size="sm" variant="light" color="yellow">
          {item.price} ₽
        </Badge>
      )}
    </Group>
  );

  if (narrow) {
    return <StoreList items={items} action={action} status={status} />;
  }

  const columns: DataColumn<StoreItem, StoreSortKey>[] = [
    {
      key: 'title',
      header: 'Позиция',
      miw: 360,
      render: (item) => (
        <>
          <Text size="sm" fw={600}>
            {item.title}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {item.description}
          </Text>
        </>
      ),
    },
    {
      key: 'kind',
      header: 'Вид',
      w: 160,
      render: (item) => (
        <Badge size="sm" variant="light" color={KIND_COLOR[item.kind]} tt="none">
          {KIND_LABEL[item.kind]}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Состояние',
      w: 190,
      render: status,
    },
    {
      header: '',
      w: 150,
      stopClick: true,
      render: action,
    },
  ];

  return (
    <DataTable
      rows={items}
      columns={columns}
      rowKey={(item) => `${item.kind}:${item.key}`}
      sort={sort}
      onSort={onSort}
      minWidth={860}
    />
  );
}

/** Компактный список на телефоне — стили общие со справочником препаратов. */
function StoreList({
  items,
  action,
  status,
}: {
  items: StoreItem[];
  action: (item: StoreItem) => React.ReactNode;
  status: (item: StoreItem) => React.ReactNode;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(items, 40);

  return (
    <Stack gap={0}>
      {visible.map((item) => (
        <div key={`${item.kind}:${item.key}`} className={classes.row}>
          <div className={classes.main}>
            <Text size="sm" fw={600}>
              {item.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {item.description}
            </Text>
            <Group gap="xs" mt={6} wrap="wrap">
              <Badge size="sm" variant="light" color={KIND_COLOR[item.kind]} tt="none">
                {KIND_LABEL[item.kind]}
              </Badge>
              {status(item)}
            </Group>
          </div>
          {action(item)}
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
