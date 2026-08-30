import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEdit, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import { QueryState } from '../../components/common/QueryState';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { AbbreviationForm } from './AbbreviationForm';
import type { Abbreviation, AbbreviationInput } from './types';
import { QUERY_KEY, useAbbreviations, useAbbreviationSections } from './useAbbreviations';
import classes from '../drugs/DrugList.module.css';

const ALL_SECTIONS = '__all__';
const NO_SECTION = 'Без раздела';

type SortKey = 'short' | 'full' | 'category';
const SORT_KEYS: readonly SortKey[] = ['short', 'full', 'category'];

const sectionOf = (row: Abbreviation) => row.category.trim() || NO_SECTION;

/** Ниже этой длины запрос ищется только по самому сокращению, и только с его начала. */
const SHORT_QUERY = 3;

/**
 * Совпадение по сокращению, расшифровке и англоязычному соответствию: врач ищет и «ХОБЛ», и
 * «обструктивная», и «COPD».
 *
 * **Короткий запрос ищется только по сокращению и только с начала**, и это замер, а не осторожность.
 * Сокращения бывают в две буквы, и подстрочный поиск по расшифровке превращает их в решето: «ОА»
 * находило «брОнхоАльвеолярный лаваж», «кАрдиОтокография» и ещё тринадцать строк, между которыми
 * терялись два настоящих ответа. С правилом остаётся шесть, и все шесть начинаются на «ОА».
 *
 * **Пояснение не ищется вовсе.** Оно написано для чтения, а не для поиска: «ХОБЛ» находило бы
 * заодно «ОФВ₁», в пояснении которого эта аббревиатура упомянута, и первым в списке оказывался бы
 * не тот ответ.
 */
function matches(row: Abbreviation, query: string): boolean {
  if (!query) return true;
  if (query.length <= SHORT_QUERY) return row.short.toLowerCase().startsWith(query);
  return (
    row.short.toLowerCase().includes(query) ||
    row.full.toLowerCase().includes(query) ||
    row.origin.toLowerCase().includes(query)
  );
}

/**
 * Справочник сокращений.
 *
 * Устроен как формуляр препаратов: таблица с поиском, фильтр по разделу, на телефоне — компактный
 * список, порционная отрисовка. Своя запись заводится тут же, окном.
 *
 * **Одно и то же сокращение встречается в списке столько раз, сколько у него значений**, и строки
 * эти стоят рядом — список отсортирован по сокращению. Больше того, у таких записей стоит отметка
 * «ещё N значения»: врач, нашедший «ОА — остеоартроз», обязан увидеть, что рядом лежит «ОА — общий
 * анализ». Иначе справочник отвечает верно ровно наполовину, а какая половина досталась — не видно.
 */
export function AbbreviationsCatalog() {
  const { abbreviations, isLoading, error, refetch, createAbbreviation, updateAbbreviation, deleteAbbreviation } =
    useAbbreviations();
  const sections = useAbbreviationSections();
  const confirmDelete = useDeleteWithConfirm();

  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string>(ALL_SECTIONS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Abbreviation | null>(null);

  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<SortKey>(
    { key: 'short', direction: 'asc' },
    { storageKey: 'medassist:sort:abbreviations', keys: SORT_KEYS },
  );

  /** Сколько значений у каждого сокращения — по нему и ставится отметка о многозначности. */
  const meaningCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of abbreviations) {
      const key = row.short.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [abbreviations]);

  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of abbreviations) {
      const name = sectionOf(row);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [abbreviations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return abbreviations.filter(
      (row) => (section === ALL_SECTIONS || sectionOf(row) === section) && matches(row, query),
    );
  }, [abbreviations, search, section]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (row, key) =>
        key === 'short' ? row.short.toLowerCase() : key === 'full' ? row.full.toLowerCase() : sectionOf(row),
      ),
    [filtered, sort],
  );

  const isFiltering = search.trim() !== '' || section !== ALL_SECTIONS;

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (row: Abbreviation) => {
    setEditing(row);
    setFormOpen(true);
  };

  /**
   * После сохранения запись обязана быть видна.
   *
   * Отбор снимается, если новая запись под него не подходит: врач, добавивший «ПМСП» при
   * включённом фильтре «Кардиология», увидел бы прежний список без своей строки и прочитал бы это
   * как «не сохранилось». Найдено прогоном — ровно так и вышло.
   *
   * Снимается только то, что мешает: поиск, если запись под него не попадает, и раздел, если она
   * из другого. Сбрасывать всё подряд значило бы отбирать у врача отбор, который он выставил сам.
   */
  const submit = async (input: AbbreviationInput) => {
    const saved = editing
      ? await updateAbbreviation(editing.id, input)
      : await createAbbreviation(input);

    const query = search.trim().toLowerCase();
    if (query && !matches(saved, query)) setSearch('');
    if (section !== ALL_SECTIONS && sectionOf(saved) !== section) setSection(ALL_SECTIONS);
    return saved;
  };

  const handleDelete = (row: Abbreviation) =>
    confirmDelete({
      what: 'сокращение',
      name: `${row.short} — ${row.full}`,
      notice: 'Сокращение удалено из справочника',
      queryKey: QUERY_KEY,
      id: row.id,
      perform: () => deleteAbbreviation(row.id),
    });

  const ambiguity = (row: Abbreviation) => (meaningCounts.get(row.short.toLowerCase()) ?? 1) - 1;

  const columns: DataColumn<Abbreviation, SortKey>[] = [
    {
      key: 'short',
      header: 'Сокращение',
      w: 190,
      render: (row) => (
        <Group gap={6} wrap="nowrap">
          <Text fw={600} size="sm">
            {row.short}
          </Text>
          {ambiguity(row) > 0 && (
            <Badge size="xs" variant="light" color="orange" tt="none">
              ещё {ambiguity(row)}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: 'full',
      header: 'Расшифровка',
      miw: 360,
      render: (row) => (
        <>
          <Text size="sm">{row.full}</Text>
          {row.meaning && (
            <Text size="xs" c="dimmed">
              {row.meaning}
            </Text>
          )}
        </>
      ),
    },
    {
      header: 'Англ.',
      w: 150,
      render: (row) =>
        row.origin ? (
          <Text size="sm" c="dimmed" ff="monospace">
            {row.origin}
          </Text>
        ) : null,
    },
    {
      key: 'category',
      header: 'Раздел',
      w: 220,
      render: (row) => (
        <Text size="sm" c="dimmed">
          {sectionOf(row)}
        </Text>
      ),
    },
    {
      w: 90,
      stopClick: true,
      render: (row) => (
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(row)} aria-label={`Править ${row.short}`}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(row)} aria-label={`Удалить ${row.short}`}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text c="dimmed" size="sm">
            {isFiltering
              ? `Найдено: ${sorted.length} из ${abbreviations.length}`
              : `${abbreviations.length} сокращений в справочнике`}
          </Text>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Сокращение, расшифровка, англ."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={300}
            />
            <Select
              data={[
                { value: ALL_SECTIONS, label: `Все разделы (${abbreviations.length})` },
                ...sections.map((name) => ({ value: name, label: `${name} (${sectionCounts.get(name) ?? 0})` })),
                ...(sectionCounts.has(NO_SECTION)
                  ? [{ value: NO_SECTION, label: `${NO_SECTION} (${sectionCounts.get(NO_SECTION) ?? 0})` }]
                  : []),
              ]}
              value={section}
              onChange={(value) => setSection(value ?? ALL_SECTIONS)}
              allowDeselect={false}
              w={280}
            />
            <Button leftSection={<IconPlus size={18} />} onClick={openNew}>
              Добавить
            </Button>
          </Group>
        </Group>

        <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="справочник сокращений">
          {sorted.length === 0 ? (
            <Card withBorder padding="xl">
              <Stack align="center" gap="sm" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconX size={24} />
                </ThemeIcon>
                <Text fw={600}>Ничего не найдено</Text>
                <Text size="sm" c="dimmed" ta="center" maw={460}>
                  Такого сокращения в справочнике нет. Его можно добавить — своя запись остаётся в
                  вашем рабочем пространстве и обновлениями справочника не затирается.
                </Text>
                <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openNew}>
                  Добавить сокращение
                </Button>
              </Stack>
            </Card>
          ) : (
            <Card withBorder padding={0}>
              {isNarrow ? (
                <AbbreviationList rows={sorted} ambiguity={ambiguity} onEdit={openEdit} onDelete={handleDelete} />
              ) : (
                <DataTable
                  rows={sorted}
                  columns={columns}
                  rowKey={(row) => row.id}
                  sort={sort}
                  onSort={toggle}
                  minWidth={960}
                />
              )}
            </Card>
          )}
        </QueryState>
      </Stack>

      <AbbreviationForm
        opened={formOpen}
        editing={editing}
        sections={sections}
        onClose={() => setFormOpen(false)}
        onSubmit={submit}
      />
    </>
  );
}

/**
 * Компактный список на телефоне.
 *
 * Пять колонок на экране 390 требуют бокового смахивания ради каждой, кроме первой; здесь вместо
 * них две строки на запись. Стили общие со справочником препаратов — это один и тот же список.
 */
function AbbreviationList({
  rows,
  ambiguity,
  onEdit,
  onDelete,
}: {
  rows: Abbreviation[];
  ambiguity: (row: Abbreviation) => number;
  onEdit: (row: Abbreviation) => void;
  onDelete: (row: Abbreviation) => void;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows, 40);

  return (
    <Stack gap={0}>
      {visible.map((row) => (
        <div key={row.id} className={classes.row}>
          <div className={classes.main}>
            <Group gap={6} wrap="nowrap" align="center">
              <Text fw={600} size="sm">
                {row.short}
              </Text>
              {ambiguity(row) > 0 && (
                <Badge size="xs" variant="light" color="orange" tt="none">
                  ещё {ambiguity(row)}
                </Badge>
              )}
              {row.origin && (
                <Text size="xs" c="dimmed" ff="monospace">
                  {row.origin}
                </Text>
              )}
            </Group>
            <Text size="sm">{row.full}</Text>
            {row.meaning && (
              <Text size="xs" c="dimmed">
                {row.meaning}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              {sectionOf(row)}
            </Text>
          </div>
          <Group gap={2} wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(row)} aria-label={`Править ${row.short}`}>
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={() => onDelete(row)} aria-label={`Удалить ${row.short}`}>
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
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
