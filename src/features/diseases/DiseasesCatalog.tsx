import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Group, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronRight, IconEdit, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import { CatalogPanel } from '../../components/common/CatalogPanel';
import { QueryState } from '../../components/common/QueryState';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import type { Disease } from './types';
import { QUERY_KEY, useDiseases } from './useDiseases';
import classes from '../drugs/DrugList.module.css';

const ALL_SECTIONS = '__all__';
const NO_SECTION = 'Без раздела';

type SortKey = 'name' | 'codes' | 'category';
const SORT_KEYS: readonly SortKey[] = ['name', 'codes', 'category'];

const sectionOf = (row: Disease) => row.category.trim() || NO_SECTION;

/**
 * Совпадение по названию, синонимам и коду МКБ.
 *
 * Синонимы здесь не украшение и ищутся наравне с названием: врач набирает «мерцалка» или «ХОБЛ» —
 * то, что сказал пациент или что стоит в чужой выписке, а не то, как нозология названа в
 * номенклатуре. Суть (`summary`) не ищется: это фраза для чтения, и поиск по ней выдавал бы
 * болезнь, у которой искомое слово стоит в пояснении, выше той, которая так называется.
 */
function matches(row: Disease, query: string): boolean {
  if (!query) return true;
  return (
    row.name.toLowerCase().includes(query) ||
    row.synonyms.some((s) => s.toLowerCase().includes(query)) ||
    row.icdCodes.some((c) => c.toLowerCase().startsWith(query))
  );
}

interface Props {
  onOpen: (row: Disease) => void;
  /** `null` — создать новую запись. */
  onEdit: (row: Disease | null) => void;
}

export function DiseasesCatalog({ onOpen, onEdit }: Props) {
  const { diseases, isLoading, error, refetch, deleteDisease } = useDiseases();
  const confirmDelete = useDeleteWithConfirm();

  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string>(ALL_SECTIONS);
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<SortKey>(
    { key: 'name', direction: 'asc' },
    { storageKey: 'medassist:sort:diseases', keys: SORT_KEYS },
  );

  /** Разделы берутся из самих записей: отдельного списка у заболеваний нет — он и есть список специальностей. */
  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of diseases) counts.set(sectionOf(row), (counts.get(sectionOf(row)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [diseases]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return diseases.filter((row) => (section === ALL_SECTIONS || sectionOf(row) === section) && matches(row, query));
  }, [diseases, search, section]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (row, key) =>
        key === 'name' ? row.name.toLowerCase() : key === 'codes' ? (row.icdCodes[0] ?? null) : sectionOf(row),
      ),
    [filtered, sort],
  );

  const isFiltering = search.trim() !== '' || section !== ALL_SECTIONS;

  // Правка и добавление живут на своей странице: у описания полноценный редактор, и в окне ему
  // тесно ровно настолько, насколько длинный текст не помещается в окно.
  const openNew = () => onEdit(null);
  const openEdit = (row: Disease) => onEdit(row);

  const handleDelete = (row: Disease) =>
    confirmDelete({
      what: 'заболевание',
      name: row.name,
      notice: 'Заболевание удалено из справочника',
      queryKey: QUERY_KEY,
      id: row.id,
      perform: () => deleteDisease(row.id),
    });

  const columns: DataColumn<Disease, SortKey>[] = [
    {
      key: 'name',
      header: 'Заболевание',
      miw: 320,
      render: (row) => (
        <>
          <Text size="sm" fw={600}>
            {row.name}
          </Text>
          {row.summary && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {row.summary}
            </Text>
          )}
          {row.synonyms.length > 0 && (
            <Text size="xs" c="dimmed">
              {row.synonyms.join(' · ')}
            </Text>
          )}
        </>
      ),
    },
    {
      key: 'codes',
      header: 'МКБ-10',
      w: 190,
      // Коды перечисляются все: болезнь часто кодируется группой рубрик, и один код из четырёх —
      // это подсказка поставить, возможно, не тот.
      render: (row) =>
        row.icdCodes.length === 0 ? (
          <Text size="xs" c="dimmed">
            не сопоставлен
          </Text>
        ) : (
          <Group gap={4} wrap="wrap">
            {row.icdCodes.map((code) => (
              <Badge key={code} size="sm" variant="light" color="gray" ff="monospace" tt="none">
                {code}
              </Badge>
            ))}
          </Group>
        ),
    },
    {
      key: 'category',
      header: 'Раздел',
      w: 230,
      render: (row) => (
        <Text size="sm" c="dimmed">
          {sectionOf(row)}
        </Text>
      ),
    },
    {
      w: 96,
      stopClick: true,
      render: (row) => (
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(row)} aria-label={`Править ${row.name}`}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(row)} aria-label={`Удалить ${row.name}`}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ),
    },
  ];

  const header = (
    <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text c="dimmed" size="sm">
            {isFiltering ? `Найдено: ${sorted.length} из ${diseases.length}` : `${diseases.length} заболеваний в справочнике`}
          </Text>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Название, синоним или код МКБ"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={300}
            />
            <Select
              data={[
                { value: ALL_SECTIONS, label: `Все разделы (${diseases.length})` },
                ...sections.map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
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
  );

  return (
    <CatalogPanel header={header}>
      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="справочник заболеваний">
        {sorted.length === 0 ? (
            <Box p="xl">
              <Stack align="center" gap="sm" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconX size={24} />
                </ThemeIcon>
                <Text fw={600}>Ничего не найдено</Text>
                <Text size="sm" c="dimmed" ta="center" maw={460}>
                  Такого заболевания в справочнике нет. Его можно добавить — своя запись остаётся в
                  вашем рабочем пространстве и обновлениями справочника не затирается.
                </Text>
                <Button variant="light" leftSection={<IconPlus size={16} />} onClick={openNew}>
                  Добавить заболевание
                </Button>
            </Stack>
          </Box>
        ) : isNarrow ? (
          <DiseaseList rows={sorted} onOpen={onOpen} />
        ) : (
          <DataTable
            rows={sorted}
            columns={columns}
            rowKey={(row) => row.id}
            sort={sort}
            onSort={toggle}
            onRowClick={onOpen}
            minWidth={920}
          />
        )}
      </QueryState>
    </CatalogPanel>
  );
}

/** Компактный список на телефоне — стили общие со справочником препаратов. */
function DiseaseList({ rows, onOpen }: { rows: Disease[]; onOpen: (row: Disease) => void }) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows, 40);

  return (
    <Stack gap={0}>
      {visible.map((row) => (
        <div key={row.id} className={classes.row}>
          <button type="button" className={classes.main} onClick={() => onOpen(row)} style={{ background: 'none', border: 0, textAlign: 'left' }}>
            <Text size="sm" fw={600}>
              {row.name}
            </Text>
            {row.summary && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {row.summary}
              </Text>
            )}
            <Group gap={4} wrap="wrap" mt={4}>
              {row.icdCodes.slice(0, 4).map((code) => (
                <Badge key={code} size="xs" variant="light" color="gray" ff="monospace" tt="none">
                  {code}
                </Badge>
              ))}
              <Text size="xs" c="dimmed">
                {sectionOf(row)}
              </Text>
            </Group>
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
