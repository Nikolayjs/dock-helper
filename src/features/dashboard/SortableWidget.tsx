import { useRef, useState } from 'react';
import { ActionIcon, Badge, Card, Grid, Group, Tooltip } from '@mantine/core';
import { IconEyeOff, IconGripVertical } from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { clampSpan, MAX_SPAN } from './dashboardLayout';
import type { DashboardContext } from './dashboardContext';
import type { DashboardWidget } from './widgets';

interface SortableWidgetProps {
  widget: DashboardWidget;
  ctx: DashboardContext;
  editing: boolean;
  /** Columns out of twelve, on `md` and wider. */
  span: number;
  /** True when the grid is wide enough for widths to mean anything at all. */
  resizable: boolean;
  onHide: () => void;
  onResize: (span: number) => void;
}

export function SortableWidget({ widget, ctx, editing, span, resizable, onHide, onResize }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });

  // Held locally while dragging the edge so the card follows the pointer without writing
  // localStorage on every frame; the width is committed once, on release.
  const [previewSpan, setPreviewSpan] = useState<number | null>(null);
  const resizeRef = useRef<{ startX: number; startSpan: number; columnWidth: number } | null>(null);

  const effectiveSpan = previewSpan ?? span;
  const isEmptyNow = widget.isEmpty?.(ctx) ?? false;

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const grid = event.currentTarget.closest('[data-dashboard-grid]');
    if (!grid) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      startX: event.clientX,
      startSpan: span,
      // Gutters make this a little narrow, which snapping absorbs.
      columnWidth: grid.getBoundingClientRect().width / MAX_SPAN,
    };
    setPreviewSpan(span);
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current;
    if (!state || state.columnWidth <= 0) return;
    const columns = Math.round((event.clientX - state.startX) / state.columnWidth);
    setPreviewSpan(clampSpan(state.startSpan + columns));
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (state && previewSpan !== null && previewSpan !== span) onResize(previewSpan);
    setPreviewSpan(null);
  };

  const content = widget.bare ? (
    widget.render(ctx)
  ) : (
    <Card withBorder padding="lg" h="100%">
      {widget.render(ctx)}
    </Card>
  );

  return (
    <Grid.Col span={{ base: 12, md: effectiveSpan }}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: previewSpan === null ? transition : 'none',
          position: 'relative',
          height: '100%',
          opacity: isDragging ? 0.4 : 1,
          zIndex: isDragging || previewSpan !== null ? 1 : undefined,
        }}
      >
        {editing && (
          <Group gap={4} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }} wrap="nowrap">
            {isEmptyNow && (
              <Badge size="xs" variant="light" color="gray">
                пусто
              </Badge>
            )}
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

        {editing && resizable && (
          <div
            role="separator"
            aria-label={`Ширина карточки «${widget.title}»: ${effectiveSpan} из ${MAX_SPAN}`}
            onPointerDown={beginResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              right: -6,
              width: 12,
              cursor: 'col-resize',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                width: 4,
                height: 44,
                borderRadius: 999,
                background:
                  previewSpan === null ? 'var(--mantine-color-default-border)' : 'var(--mantine-color-brand-6)',
              }}
            />
          </div>
        )}

        {previewSpan !== null && (
          <Badge
            size="xs"
            variant="filled"
            color="brand"
            style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 3 }}
          >
            {previewSpan} / {MAX_SPAN}
          </Badge>
        )}
      </div>
    </Grid.Col>
  );
}
