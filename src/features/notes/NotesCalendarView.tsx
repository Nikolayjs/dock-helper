import { useMemo } from 'react';
import { Button, Card, Grid, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { NoteCard } from './NoteCard';
import type { Note } from './types';
import { MarkedCalendar } from '../../components/common/MarkedCalendar';

function formatNotesCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} заметка закреплена`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} заметки закреплены`;
  return `${count} заметок закреплено`;
}

interface NotesCalendarViewProps {
  notes: Note[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onAddForSelectedDate: () => void;
  onOpenNote: (note: Note) => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onToggleItem: (noteId: string, itemId: string) => void;
}

export function NotesCalendarView({
  notes,
  selectedDate,
  onSelectDate,
  onAddForSelectedDate,
  onOpenNote,
  onEditNote,
  onDeleteNote,
  onToggleItem,
}: NotesCalendarViewProps) {
  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const note of notes) {
      if (!note.pinnedDate) continue;
      const list = map.get(note.pinnedDate) ?? [];
      list.push(note);
      map.set(note.pinnedDate, list);
    }
    return map;
  }, [notes]);

  const selectedNotes = notesByDate.get(selectedDate) ?? [];

  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 5 }}>
        <Card withBorder padding="lg">
          <MarkedCalendar
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            entriesByDate={notesByDate}
            dotColor="var(--mantine-color-brand-6)"
          />
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 7 }}>
        <Card withBorder padding="lg" h="100%">
          <Group justify="space-between" mb="md">
            <div>
              <Text fw={600} size="sm" tt="capitalize">
                {dayjs(selectedDate).format('D MMMM YYYY, dddd')}
              </Text>
              <Text size="xs" c="dimmed">
                {selectedNotes.length > 0 ? formatNotesCount(selectedNotes.length) : 'Нет заметок на этот день'}
              </Text>
            </div>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={onAddForSelectedDate}>
              Добавить
            </Button>
          </Group>

          {selectedNotes.length > 0 ? (
            <ScrollArea.Autosize mah={480}>
              <Stack gap="sm">
                {selectedNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onOpen={() => onOpenNote(note)}
                    onEdit={() => onEditNote(note)}
                    onDelete={() => onDeleteNote(note)}
                    onToggleItem={(itemId) => onToggleItem(note.id, itemId)}
                  />
                ))}
              </Stack>
            </ScrollArea.Autosize>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              Выберите день и добавьте первую заметку.
            </Text>
          )}
        </Card>
      </Grid.Col>
    </Grid>
  );
}
