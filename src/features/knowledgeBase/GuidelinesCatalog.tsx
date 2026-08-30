import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconBook2, IconEdit, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react';

import { SortableTh } from '../../components/common/SortableTh';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { sortRows, useTableSort } from '../../lib/tableSort';
import type { SortValue } from '../../lib/tableSort';
import type { KnowledgeDocumentSummary } from './types';

/**
 * Справочник клинических рекомендаций — списком, а не сеткой карточек.
 *
 * Двести с лишним нозологий в виде плиток нельзя ни просмотреть, ни сравнить: карточка занимает
 * пол-экрана, а нужен здесь беглый поиск по названию и отбор по специальности. Поэтому раздел
 * устроен как формуляр препаратов — таблица с поиском, фильтром и сортировкой, а на телефоне
 * компактный список.
 *
 * **Раздел — это первый тег.** Отдельной колонки под специальность у документа нет, и заводить её
 * значило бы менять список полей каталога тем же релизом, что и содержимое (см. `CLAUDE.md` про
 * отпечатки). Соглашение соблюдает сид; у рекомендации, написанной врачом, разделом становится её
 * первый тег, а без тегов — «Без раздела», и она не теряется в фильтре.
 */

import { CatalogPanel } from '../../components/common/CatalogPanel';
import { SpecialtyFilterNotice, SpecialtyFilterSwitch } from '../specialties/SpecialtyFilterControls';
import { useSpecialtyFilter } from '../specialties/useSpecialtyFilter';

const ALL_SECTIONS = '__all__';
const NO_SECTION = 'Без раздела';

const sectionOf = (doc: KnowledgeDocumentSummary) => doc.tags[0]?.trim() || NO_SECTION;

type GuidelineSortKey = 'title' | 'section' | 'tags' | 'updated';
const SORT_KEYS: readonly GuidelineSortKey[] = ['title', 'section', 'tags', 'updated'];

function sortValue(doc: KnowledgeDocumentSummary, key: GuidelineSortKey): SortValue {
  switch (key) {
    case 'title':
      return doc.title;
    case 'section':
      return sectionOf(doc);
    case 'tags':
      // Число, а не текст: сортировка по первому тегу повторяла бы сортировку по разделу.
      return doc.tags.length || null;
    case 'updated':
      return doc.updatedAt;
  }
}

interface GuidelinesCatalogProps {
  documents: KnowledgeDocumentSummary[];
  onAdd: () => void;
  onOpen: (doc: KnowledgeDocumentSummary) => void;
  onEdit: (doc: KnowledgeDocumentSummary) => void;
  onDelete: (doc: KnowledgeDocumentSummary) => void;
  onTagClick: (tag: string) => void;
}

export function GuidelinesCatalog({ documents, onAdd, onOpen, onEdit, onDelete, onTagClick }: GuidelinesCatalogProps) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string>(ALL_SECTIONS);
  const specialtyFilter = useSpecialtyFilter('guidelines');
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<GuidelineSortKey>(
    { key: 'title', direction: 'asc' },
    { storageKey: 'medassist:sort:guidelines', keys: SORT_KEYS },
  );

  const sections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of documents) {
      const name = sectionOf(doc);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return counts;
  }, [documents]);

  // Считается дважды — со специальностью и без. Второй набор нужен, чтобы сказать, сколько
  // рекомендаций отбор спрятал: молча показанный короткий список читается как весь справочник.
  const withoutSpecialty = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (section !== ALL_SECTIONS && sectionOf(doc) !== section) return false;
      if (!query) return true;
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.summary.toLowerCase().includes(query) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [documents, search, section]);

  const filtered = useMemo(
    () =>
      specialtyFilter.active
        ? withoutSpecialty.filter((doc) => specialtyFilter.matches(sectionOf(doc)))
        : withoutSpecialty,
    [withoutSpecialty, specialtyFilter],
  );

  const sorted = useMemo(() => sortRows(filtered, sort, sortValue), [filtered, sort]);
  const isFiltering = search.trim().length > 0 || section !== ALL_SECTIONS || specialtyFilter.active;

  return (
    <CatalogPanel
      header={
        <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Text c="dimmed" size="sm">
            {isFiltering
              ? `Найдено: ${filtered.length} из ${documents.length}`
              : `${documents.length} рекомендаций в справочнике`}
          </Text>
          <SpecialtyFilterNotice
            filter={specialtyFilter}
            hidden={withoutSpecialty.length - filtered.length}
            visible={filtered.length}
            unit={['рекомендацию', 'рекомендации', 'рекомендаций']}
          />
        </Stack>
        <Group gap="sm" wrap="wrap">
          <SpecialtyFilterSwitch filter={specialtyFilter} />
          <TextInput
            placeholder="Заболевание, синдром, тег…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={280}
          />
          <Select
            data={[
              { value: ALL_SECTIONS, label: `Все разделы (${documents.length})` },
              ...[...sections.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
            ]}
            value={section}
            onChange={(value) => setSection(value ?? ALL_SECTIONS)}
            allowDeselect={false}
            w={280}
          />
          <Button leftSection={<IconPlus size={18} />} onClick={onAdd}>
            Добавить рекомендацию
          </Button>
        </Group>
        </Group>
      }
    >
      {sorted.length === 0 ? (
        <Box p="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              {isFiltering ? <IconX size={24} /> : <IconBook2 size={24} />}
            </ThemeIcon>
            <Text fw={600}>{isFiltering ? 'Ничего не найдено' : 'Пока нет клинических рекомендаций'}</Text>
            <Text size="sm" c="dimmed" ta="center" maw={440}>
              {isFiltering
                ? 'Попробуйте изменить запрос или снять фильтр по разделу.'
                : 'Добавьте протокол, чек-лист или конспект рекомендаций с форматированным текстом.'}
            </Text>
          </Stack>
        </Box>
      ) : (
        <>
          {isNarrow ? (
            <GuidelineList documents={sorted} onOpen={onOpen} />
          ) : (
            <GuidelineTable
              documents={sorted}
              sort={sort}
              onSort={toggle}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onTagClick={onTagClick}
            />
          )}
        </>
      )}
    </CatalogPanel>
  );
}

function GuidelineTable({
  documents,
  sort,
  onSort,
  onOpen,
  onEdit,
  onDelete,
  onTagClick,
}: {
  documents: KnowledgeDocumentSummary[];
  sort: ReturnType<typeof useTableSort<GuidelineSortKey>>['sort'];
  onSort: (key: GuidelineSortKey) => void;
  onOpen: (doc: KnowledgeDocumentSummary) => void;
  onEdit: (doc: KnowledgeDocumentSummary) => void;
  onDelete: (doc: KnowledgeDocumentSummary) => void;
  onTagClick: (tag: string) => void;
}) {
  // Фильтрация и сортировка идут по всему набору — порционно только рисуется.
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(documents);

  return (
    <Table.ScrollContainer minWidth={900}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <SortableTh column="title" sort={sort} onSort={onSort} miw={340}>
              Название
            </SortableTh>
            <SortableTh column="section" sort={sort} onSort={onSort} miw={280}>
              Раздел
            </SortableTh>
            <SortableTh column="tags" sort={sort} onSort={onSort} miw={180}>
              Теги
            </SortableTh>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {visible.map((doc) => (
            <Table.Tr key={doc.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(doc)}>
              <Table.Td>
                <Text fw={600} size="sm" lineClamp={1}>
                  {doc.title}
                </Text>
                {doc.summary.trim() && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {doc.summary}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" lineClamp={1}>
                  {sectionOf(doc)}
                </Text>
              </Table.Td>
              <Table.Td>
                {/* Первый тег — это раздел, он уже показан колонкой рядом; здесь только уточняющие. */}
                <Group gap={4} wrap="wrap">
                  {doc.tags.slice(1).map((tag) => (
                    <Badge
                      key={tag}
                      size="xs"
                      variant="light"
                      color="gray"
                      style={{ cursor: 'pointer' }}
                      onClick={(event) => {
                        event.stopPropagation();
                        onTagClick(tag);
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                  {doc.tags.length <= 1 && (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap={2} justify="flex-end" wrap="nowrap" onClick={(event) => event.stopPropagation()}>
                  <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(doc)} aria-label="Редактировать">
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => onDelete(doc)} aria-label="Удалить">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {hasMore && (
        <Text ref={setSentinel} size="xs" c="dimmed" ta="center" py="sm">
          Загружается ещё… осталось {remaining}
        </Text>
      )}
    </Table.ScrollContainer>
  );
}

/**
 * На телефоне таблица из четырёх колонок требует бокового смахивания ради каждого поля, кроме
 * первого, — там вместо неё компактный список, как в справочнике препаратов.
 */
function GuidelineList({
  documents,
  onOpen,
}: {
  documents: KnowledgeDocumentSummary[];
  onOpen: (doc: KnowledgeDocumentSummary) => void;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(documents);

  return (
    <Stack gap={0}>
      {visible.map((doc) => (
        <Group
          key={doc.id}
          px="md"
          py="sm"
          wrap="nowrap"
          align="flex-start"
          style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-default-border)' }}
          onClick={() => onOpen(doc)}
        >
          <ThemeIcon variant="light" color="brand" size={32} radius="md">
            <IconBook2 size={16} />
          </ThemeIcon>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} size="sm" lineClamp={2}>
              {doc.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {sectionOf(doc)}
            </Text>
          </div>
        </Group>
      ))}
      {hasMore && (
        <Text ref={setSentinel} size="xs" c="dimmed" ta="center" py="sm">
          Загружается ещё… осталось {remaining}
        </Text>
      )}
    </Stack>
  );
}
