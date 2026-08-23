import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Badge, Box, Group, Paper, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';

import { PlannerCardItem } from './PlannerCardItem';
import type { PlannerCard, PlannerColumn } from './types';

interface PlannerColumnCardProps {
  column: PlannerColumn;
  cards: PlannerCard[];
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddCard: () => void;
  onOpenCard: (card: PlannerCard) => void;
}

export function PlannerColumnCard({ column, cards, onRename, onDelete, onAddCard, onOpenCard }: PlannerColumnCardProps) {
  const [title, setTitle] = useState(column.title);
  useEffect(() => setTitle(column.title), [column.title]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `dropzone-${column.id}`,
    data: { type: 'column-dropzone', columnId: column.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Paper ref={setNodeRef} style={{ ...style, width: 280, flexShrink: 0 }} withBorder radius="lg" p="sm">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Group gap={4} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            <Box {...attributes} {...listeners} style={{ cursor: 'grab', touchAction: 'none', display: 'flex', color: 'var(--mantine-color-dimmed)' }}>
              <IconGripVertical size={16} />
            </Box>
            <TextInput
              variant="unstyled"
              value={title}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setTitle(value);
              }}
              onBlur={() => {
                const trimmed = title.trim();
                if (trimmed && trimmed !== column.title) onRename(trimmed);
                else setTitle(column.title);
              }}
              styles={{ input: { fontWeight: 600, fontSize: 'var(--mantine-font-size-sm)' } }}
              style={{ flex: 1, minWidth: 0 }}
            />
          </Group>
          <Group gap={4} wrap="nowrap">
            <Badge size="xs" variant="light" color="gray">
              {cards.length}
            </Badge>
            <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete} aria-label="Удалить колонку">
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>

        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <Stack
            ref={setDropRef}
            gap={8}
            mih={40}
            style={{
              borderRadius: 8,
              outline: isOver ? '2px dashed var(--mantine-color-brand-4)' : 'none',
              outlineOffset: 2,
              transition: 'outline-color 100ms ease',
            }}
          >
            {cards.map((card) => (
              <PlannerCardItem key={card.id} card={card} onOpen={onOpenCard} />
            ))}
          </Stack>
        </SortableContext>

        <UnstyledButton
          onClick={onAddCard}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            borderRadius: 8,
            color: 'var(--mantine-color-dimmed)',
          }}
        >
          <IconPlus size={14} />
          <Text size="sm">Добавить карточку</Text>
        </UnstyledButton>
      </Stack>
    </Paper>
  );
}
