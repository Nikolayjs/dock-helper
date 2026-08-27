import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Badge, Card, Group, Tooltip } from '@mantine/core';
import { IconEyeOff, IconGripVertical } from '@tabler/icons-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import classes from './DashboardGrid.module.css';
import { clampSpan, MAX_SPAN } from './dashboardLayout';
import type { DashboardContext } from './dashboardContext';
import type { DashboardWidget } from './widgets';

/** Шаг сетки по вертикали, в пикселях. Должен совпадать с `grid-auto-rows` в стилях. */
const ROW_UNIT = 4;
/** Вертикальный промежуток между карточками; закладывается в пролёт, а не в `row-gap`. */
const ROW_GAP = 24;

interface SortableWidgetProps {
  widget: DashboardWidget;
  ctx: DashboardContext;
  editing: boolean;
  /** Columns out of twelve. */
  span: number;
  /** True when the grid is wide enough for widths and row spans to mean anything. */
  wide: boolean;
  onHide: () => void;
  onResize: (span: number) => void;
}

/** How much horizontal room one column takes, gap included — what a drag has to cross to add one. */
function columnPitch(grid: Element): number {
  const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
  return (grid.getBoundingClientRect().width + gap) / MAX_SPAN;
}

export function SortableWidget({ widget, ctx, editing, span, wide, onHide, onResize }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });

  // Held locally while dragging the edge so the card follows the pointer without writing
  // localStorage on every frame; the width is committed once, on release.
  const [previewSpan, setPreviewSpan] = useState<number | null>(null);
  const resizeRef = useRef<{ startX: number; startSpan: number; pitch: number } | null>(null);

  /**
   * Сколько строк сетки занимает карточка. Меряется по факту, а не считается: высота зависит от
   * содержимого, ширины и темы, и единственный, кто её знает, — браузер.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState<number | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof ResizeObserver !== 'function') return;

    const observer = new ResizeObserver(([entry]) => {
      const height = entry.target.getBoundingClientRect().height;
      setRows(Math.max(1, Math.ceil((height + ROW_GAP) / ROW_UNIT)));
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  const effectiveSpan = previewSpan ?? span;

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const grid = event.currentTarget.closest('[data-dashboard-grid]');
    if (!grid) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { startX: event.clientX, startSpan: span, pitch: columnPitch(grid) };
    setPreviewSpan(span);
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current;
    if (!state || state.pitch <= 0) return;
    setPreviewSpan(clampSpan(state.startSpan + Math.round((event.clientX - state.startX) / state.pitch)));
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

  const isEmptyNow = widget.isEmpty?.(ctx) ?? false;

  const content = widget.bare ? widget.render(ctx) : <Card withBorder padding="lg">{widget.render(ctx)}</Card>;

  return (
    <div
      ref={setNodeRef}
      className={classes.item}
      data-widget={widget.id}
      style={{
        // Именно Translate, а не Transform: dnd-kit кладёт в трансформацию ещё и scaleX/scaleY,
        // когда перетаскиваемый элемент и цель разного размера. Для одинаковых плиток это
        // незаметно, а здесь карточки разной ширины и высоты — и карточка при перетаскивании
        // раздувалась до размеров соседа.
        transform: CSS.Translate.toString(transform),
        transition: previewSpan === null ? transition : 'none',
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging || previewSpan !== null ? 1 : undefined,
        // Ниже `md` сетка однополосная: и ширина, и пролёт по строкам там бессмысленны.
        ...(wide
          ? { gridColumn: `span ${effectiveSpan}`, gridRow: rows ? `span ${rows}` : undefined }
          : { gridColumn: '1 / -1' }),
      }}
    >
      {/* Меряется и позиционируется относительно самой карточки, а не ячейки сетки: ячейка выше
          карточки настолько, насколько высок сосед, и ползунок, привязанный к ней, повисал в
          пустоте под карточкой.

          Перетаскивается тоже она целиком, а не ручка в углу: на телефоне карточку берут за
          карточку, и попасть пальцем в значок 28 px — задача, которой пользователь себе не ставил.
          Содержимое в режиме настройки всё равно не нажимается, так что отнимать у карточки нечего.
          Значок остаётся подсказкой о том, что её можно двигать. */}
      <div
        ref={cardRef}
        style={{
          position: 'relative',
          ...(editing
            ? {
                cursor: isDragging ? 'grabbing' : 'grab',
                // `manipulation`, а не `none`: прокрутить страницу пальцем по карточке нужно
                // по-прежнему — в режиме настройки экран занят ими целиком. Отличает прокрутку от
                // перетаскивания удержание (`TouchSensor` на странице), а не запрет прокрутки.
                touchAction: 'manipulation',
                // Иначе удержание на телефоне начинает выделять текст и показывает свой callout.
                userSelect: 'none',
                WebkitTouchCallout: 'none',
              }
            : null),
        }}
        {...(editing ? attributes : null)}
        {...(editing ? listeners : null)}
        aria-label={editing ? `Переместить карточку «${widget.title}»` : undefined}
      >
        {editing && (
          <Group gap={4} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }} wrap="nowrap">
            {isEmptyNow && (
              <Badge size="xs" variant="light" color="gray">
                пусто
              </Badge>
            )}
            <Tooltip label="Перетащить — или тяните саму карточку" withArrow>
              <ActionIcon component="div" variant="default" size="md" aria-hidden tabIndex={-1}>
                <IconGripVertical size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Скрыть" withArrow>
              <ActionIcon
                variant="default"
                size="md"
                onClick={onHide}
                // Нажатие на «скрыть» не должно доходить до карточки: неторопливое касание иначе
                // успевает превратиться в перетаскивание, и кнопка не срабатывает.
                onMouseDown={(event) => event.stopPropagation()}
                onTouchStart={(event) => event.stopPropagation()}
                aria-label={`Скрыть карточку «${widget.title}»`}
              >
                <IconEyeOff size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}

        {/* While arranging, the card is a tile to move — not a thing to click into. Without this a
            drag that starts on a patient's name navigates away mid-rearrange. */}
        <div style={editing ? { pointerEvents: 'none', userSelect: 'none' } : undefined}>{content}</div>

        {editing && wide && (
          <div
            role="separator"
            aria-label={`Ширина карточки «${widget.title}»: ${effectiveSpan} из ${MAX_SPAN}`}
            onPointerDown={beginResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            // Ползунок ширины — не перетаскивание карточки: `pointerdown` останавливается в
            // `beginResize`, но `touchstart` приходит после него и дошёл бы до карточки сам.
            onTouchStart={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
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
    </div>
  );
}
