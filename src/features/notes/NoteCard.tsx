import { ActionIcon, Badge, Card, Checkbox, Group, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconChecklist, IconEdit, IconNote, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { stripHtml } from './textPreview';
import type { Note } from './types';

interface NoteCardProps {
  note: Note;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleItem: (itemId: string) => void;
}

export function NoteCard({ note, onOpen, onEdit, onDelete, onToggleItem }: NoteCardProps) {
  const doneCount = note.items.filter((item) => item.done).length;

  return (
    <Card withBorder padding="md" h="100%" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon variant="light" color={note.color} size={32} radius="md">
            {note.kind === 'todo' ? <IconChecklist size={17} /> : <IconNote size={17} />}
          </ThemeIcon>
          <Text fw={600} size="sm" truncate>
            {note.title}
          </Text>
        </Group>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon aria-label="Удалить" variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      {note.pinnedDate && (
        <Badge variant="light" color={note.color} size="sm" mb="xs">
          {dayjs(note.pinnedDate).format('D MMMM')}
        </Badge>
      )}

      {note.kind === 'note' ? (
        <Text size="sm" c="dimmed" lineClamp={4}>
          {stripHtml(note.content) || 'Без текста'}
        </Text>
      ) : (
        <Stack gap={6} onClick={(e) => e.stopPropagation()}>
          {note.items.length > 0 && (
            <Progress value={(doneCount / note.items.length) * 100} color={note.color} size={6} radius="xl" mb={2} />
          )}
          <Stack gap={4}>
            {note.items.map((item) => (
              <Checkbox
                key={item.id}
                size="xs"
                label={item.text}
                checked={item.done}
                onChange={() => onToggleItem(item.id)}
                styles={{ label: item.done ? { textDecoration: 'line-through', color: 'var(--mantine-color-dimmed)' } : undefined }}
              />
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
