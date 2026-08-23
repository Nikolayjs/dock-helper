import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, SimpleGrid, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconNotes, IconPlus, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { NoteCard } from '../features/notes/NoteCard';
import { stripHtml } from '../features/notes/textPreview';
import type { Note, NoteKind } from '../features/notes/types';
import { useNotes } from '../features/notes/useNotes';

type KindFilter = 'all' | NoteKind;

export function NotesPage() {
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const navigate = useNavigate();

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [search, setSearch] = useState('');

  const handleDelete = (note: Note) => {
    deleteNote(note.id);
    notifications.show({ message: 'Заметка удалена', color: 'gray' });
  };

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

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.pinnedDate && b.pinnedDate) return a.pinnedDate.localeCompare(b.pinnedDate);
      if (a.pinnedDate) return -1;
      if (b.pinnedDate) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [filtered]);

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
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

        {sorted.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconNotes size={24} />
              </ThemeIcon>
              <Text fw={600}>Пока нет заметок</Text>
              <Text size="sm" c="dimmed">
                Создайте заметку или чек-лист — при желании закрепите её за датой.
              </Text>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {sorted.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onOpen={() => navigate(`/notes/${note.id}`)}
                onEdit={() => navigate(`/notes/${note.id}/edit`)}
                onDelete={() => handleDelete(note)}
                onToggleItem={(itemId) => toggleTodoItem(note.id, itemId)}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
