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
  /**
   * Ширина карточки под курсором — та же, что у неё в колонке.
   *
   * `DragOverlay` рисует карточку в своей коробке, и ширину она берёт по содержимому: замер на
   * 610 — 254 px в колонке против 294 под курсором. Задать её обёртке мало (проверено: карточка
   * всё равно вылезала на 294), поэтому ширина ставится самой карточке.
   */
  width?: number;
}

export function PlannerCardItem({ card, onOpen, width }: PlannerCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.columnId },
  });

  const style = {
    // `CSS.Translate`, а не `CSS.Transform`: второй кладёт в трансформацию ещё и масштаб, когда
    // перетаскиваемый элемент и цель разного размера, а карточки в колонке разной высоты. Здесь
    // масштаб в замерах не появлялся, но на дашборде эта же трансформация раздувала карточку до
    // размеров соседа — см. `SortableWidget`; в раздувании карточки планера виноват был не он.
    transform: CSS.Translate.toString(transform),
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
      // По этой метке страница находит карточку, чтобы померить её ширину перед перетаскиванием:
      // карточка под курсором обязана быть той же ширины, что в колонке.
      data-card-id={card.id}
      // Сжиматься карточке нельзя: в колонке со своей прокруткой flex сплющил бы весь список
      // вместо того, чтобы дать ему прокрутиться (замер: двенадцать карточек в полосу по 38 px).
      // `manipulation`, а не `none`: запрет прокрутки на карточке и был той поломкой — колонку с
      // карточками на телефоне нельзя было пролистать вовсе. Перетаскивание пальцем начинается по
      // удержанию (см. сенсоры на странице), и до него жест принадлежит странице.
      style={{ ...style, cursor: 'grab', touchAction: 'manipulation', flexShrink: 0, width, maxWidth: width }}
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
