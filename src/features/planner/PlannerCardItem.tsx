import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Box, Card, Group, Text } from '@mantine/core';
import { IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { MemberSignature } from './MemberSignature';
import { findMember, useWorkspaceMembers } from '../workspace/useWorkspaceMembers';
import type { PlannerCard } from './types';

interface PlannerCardItemProps {
  card: PlannerCard;
  onOpen: (card: PlannerCard) => void;
}

export function PlannerCardItem({ card, onOpen }: PlannerCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const overdue = card.dueDate ? dayjs(card.dueDate).isBefore(dayjs(), 'day') : false;

  // Подписан тот, кто взялся за работу; если не взялся никто — тот, кто карточку завёл.
  const { members } = useWorkspaceMembers();
  const assignee = findMember(members, card.assigneeId);
  const author = findMember(members, card.authorId);
  const signature = assignee ?? author;

  return (
    <Card
      ref={setNodeRef}
      style={{ ...style, cursor: 'grab', touchAction: 'none' }}
      withBorder
      radius="md"
      padding="sm"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
    >
      {card.color && <Box mb={6} h={4} w="100%" style={{ borderRadius: 999, backgroundColor: `var(--mantine-color-${card.color}-6)` }} />}
      <Text size="sm" fw={500}>
        {card.title}
      </Text>
      {card.description && (
        <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
          {card.description}
        </Text>
      )}
      {(card.dueDate || signature) && (
        <Group justify="space-between" wrap="nowrap" mt={8} gap="xs">
          {card.dueDate ? (
            <Badge size="xs" variant="light" color={overdue ? 'red' : 'gray'} leftSection={<IconCalendar size={11} />}>
              {dayjs(card.dueDate).format('D MMM')}
            </Badge>
          ) : (
            <span />
          )}
          <MemberSignature member={signature} kind={assignee ? 'assignee' : 'author'} />
        </Group>
      )}
    </Card>
  );
}
