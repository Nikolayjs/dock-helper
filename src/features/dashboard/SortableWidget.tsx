import { ActionIcon, Card, Grid, Group, Tooltip } from '@mantine/core';
import { IconEyeOff, IconGripVertical } from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { DashboardContext } from './dashboardContext';
import type { DashboardWidget } from './widgets';

interface SortableWidgetProps {
  widget: DashboardWidget;
  ctx: DashboardContext;
  editing: boolean;
  onHide: () => void;
}

export function SortableWidget({ widget, ctx, editing, onHide }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });

  const content = widget.bare ? (
    widget.render(ctx)
  ) : (
    <Card withBorder padding="lg" h="100%">
      {widget.render(ctx)}
    </Card>
  );

  return (
    <Grid.Col span={{ base: 12, md: widget.span }}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          position: 'relative',
          height: '100%',
          opacity: isDragging ? 0.4 : 1,
          zIndex: isDragging ? 1 : undefined,
        }}
      >
        {editing && (
          <Group gap={4} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
            <Tooltip label="Перетащить" withArrow>
              <ActionIcon
                variant="default"
                size="sm"
                {...attributes}
                {...listeners}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                aria-label={`Переместить карточку «${widget.title}»`}
              >
                <IconGripVertical size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Скрыть" withArrow>
              <ActionIcon variant="default" size="sm" onClick={onHide} aria-label={`Скрыть карточку «${widget.title}»`}>
                <IconEyeOff size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {/* While arranging, the card is a tile to move — not a thing to click into. Without this a
            drag that starts on a patient's name navigates away mid-rearrange. */}
        <div style={editing ? { pointerEvents: 'none', userSelect: 'none' } : undefined}>{content}</div>
      </div>
    </Grid.Col>
  );
}
