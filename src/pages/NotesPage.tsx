import { useMemo, useState } from 'react';
import { Box, Button, Container, Group, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconNotes, IconPlus, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { NOTE_SORT_KEYS, NoteTable, noteSortValue, type NoteSortKey } from '../features/notes/NoteTable';
import { CatalogPanel } from '../components/common/CatalogPanel';
import { sortRows, useTableSort } from '../lib/tableSort';
import { stripHtml } from '../features/notes/textPreview';
import type { Note, NoteKind } from '../features/notes/types';
import { QUERY_KEY as NOTES_KEY, useNotes } from '../features/notes/useNotes';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { QueryState } from '../components/common/QueryState';

type KindFilter = 'all' | NoteKind;

export function NotesPage() {
  const { notes, deleteNote, isLoading, error, refetch } = useNotes();
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');
  // На телефоне таблица из пяти колонок требует бокового смахивания — там компактный список.
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<NoteSortKey>(
    { key: 'updated', direction: 'desc' },
    { storageKey: 'medassist:sort:notes', keys: NOTE_SORT_KEYS },
  );

  const handleDelete = (note: Note) =>
    confirmDelete({
      what: 'заметку',
      name: note.title,
      notice: 'Заметка удалена',
      queryKey: NOTES_KEY,
      id: note.id,
      perform: () => deleteNote(note.id),
    });

  const filtered = useMemo(() => {
    return notes.filter((note) => {
      if (kindFilter !== 'all' && note.kind !== kindFilter) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        note.title.toLowerCase().includes(query) ||
        stripHtml(note.content).toLowerCase().includes(query) ||
        note.items.some((item) => item.text.toLowerCase().includes(query))
      );
    });
  }, [notes, kindFilter, search]);

  /**
   * Сортировка теперь у столбцов, но закреплённые за датой заметки всё равно идут первыми.
   *
   * Закрепление — это «эта заметка про такой-то день», и такая заметка нужна к приёму, а не когда
   * до неё дойдёт очередь по алфавиту. Внутри двух групп порядок задаёт выбранный столбец.
   */
  const sorted = useMemo(() => {
    const byColumn = sortRows(filtered, sort, noteSortValue);
    return [...byColumn].sort((a, b) => Number(Boolean(b.pinnedDate)) - Number(Boolean(a.pinnedDate)));
  }, [filtered, sort]);

  return (
    <Container size="xl" px={0}>
      <CatalogPanel
        header={
          <Group justify="space-between" wrap="wrap" gap="md">
          <Tabs value={kindFilter} onChange={(v) => setKindFilter((v as KindFilter) ?? 'all')} variant="pills">
            <Tabs.List>
              <Tabs.Tab value="all">Все</Tabs.Tab>
              <Tabs.Tab value="note">Заметки</Tabs.Tab>
              <Tabs.Tab value="todo">Чек-листы</Tabs.Tab>
            </Tabs.List>
          </Tabs>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Поиск по заметкам…"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={260}
            />
            <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/notes/new')}>
              Добавить заметку
            </Button>
          </Group>
          </Group>
        }
      >
        <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="заметки">
          {sorted.length === 0 ? (
            <Box p="xl">
              <Stack align="center" gap="sm" py="xl">
                <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                  <IconNotes size={24} />
                </ThemeIcon>
                <Text fw={600}>Пока нет заметок</Text>
                <Text size="sm" c="dimmed">
                  Создайте заметку или чек-лист — при желании закрепите её за датой.
                </Text>
              </Stack>
            </Box>
          ) : (
            <NoteTable
              notes={sorted}
              sort={sort}
              onSort={toggle}
              onOpen={(note) => navigate(`/notes/${note.id}`)}
              onEdit={(note) => navigate(`/notes/${note.id}/edit`)}
              onDelete={handleDelete}
              narrow={isNarrow}
            />
          )}
        </QueryState>
      </CatalogPanel>
    </Container>
  );
}
