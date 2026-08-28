import { useMemo, useState, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Modifier } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Anchor, Group, Stack } from '@mantine/core';

import { moveWidget, orderWidgets } from './dashboardLayout';
import classes from './sortableRows.module.css';

/**
 * Строка ходит только вверх-вниз и только в пределах списка.
 *
 * Написано здесь, а не взято из `@dnd-kit/modifiers`: оттуда нужны ровно две функции на пять строк,
 * а пакет — ещё одна зависимость в сборке. Без ограничителя строку можно утащить вбок за край
 * карточки и вниз за её пределы, где она повисает поверх соседней.
 */
const withinList: Modifier = ({ transform, draggingNodeRect, containerNodeRect }) => {
  const vertical = { ...transform, x: 0 };
  if (!draggingNodeRect || !containerNodeRect) return vertical;
  const top = containerNodeRect.top - draggingNodeRect.top;
  const bottom = containerNodeRect.bottom - draggingNodeRect.bottom;
  return { ...vertical, y: Math.min(Math.max(vertical.y, top), bottom) };
};

interface SortableRowsProps<T extends { id: string }> {
  /** Строки как их отдал источник: справочник, библиотека. */
  items: T[];
  /** Порядок, который врач задал раньше. Пусто — порядок источника. */
  order: string[] | undefined;
  onOrderChange: (ids: string[]) => void;
  /** Сколько строк показывать в свёрнутом виде. */
  limit: number;
  /** Строка, которая всегда идёт первой и не перетаскивается (последняя читаемая книга). */
  pinnedId?: string;
  renderRow: (item: T) => ReactNode;
  /** Подпись кнопки: «Ещё 4» — число подставляет карточка, слово зависит от того, что за строки. */
  moreLabel: (rest: number) => string;
}

/**
 * Список строк карточки: перетаскиванием переставляется, лишнее прячется под «раскрыть».
 *
 * Общий для избранных калькуляторов и книг — карточки отличаются только тем, что рисуют в строке.
 *
 * Сенсоры те же, что у самого дашборда, и по той же причине: мышь трогается с четырёх пикселей,
 * палец — только после удержания в 200 мс. Общий `PointerSensor` дал бы либо мышь, требующую
 * удержания, либо карточку, которую на телефоне нельзя пролистать, потому что смах по строке
 * начинал бы перетаскивание.
 */
export function SortableRows<T extends { id: string }>({
  items,
  order,
  onOrderChange,
  limit,
  pinnedId,
  renderRow,
  moreLabel,
}: SortableRowsProps<T>) {
  /*
   * Раскрытие помнит, при каком числе строк его включили, — и потому само гаснет, когда врач это
   * число меняет. Иначе выбор «показывать 3» на раскрытой карточке выглядел бы как «ничего не
   * произошло»: раскрытие перебивало лимит, и результат появлялся только после перезагрузки.
   * Проверено: так и было.
   */
  const [expandedAt, setExpandedAt] = useState<number | null>(null);
  const expanded = expandedAt === limit;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /*
   * Сохранённый порядок сливается с тем, что есть сейчас, а не применяется как есть: врач мог снять
   * звёздочку с калькулятора, который в порядке назван, и отметить новый, которого там нет. То же
   * правило, что у самих карточек дашборда, — и та же функция.
   *
   * Закреплённая строка выносится вперёд после слияния: её место не зависит от расстановки.
   */
  const ordered = useMemo(() => {
    const merged = orderWidgets(items, order ?? []);
    if (!pinnedId) return merged;
    const pinned = merged.find((item) => item.id === pinnedId);
    return pinned ? [pinned, ...merged.filter((item) => item.id !== pinnedId)] : merged;
  }, [items, order, pinnedId]);

  const shown = expanded ? ordered : ordered.slice(0, limit);
  const rest = ordered.length - shown.length;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onOrderChange(moveWidget(ordered.map((item) => item.id), String(active.id), String(over.id)));
  };

  return (
    <Stack gap="sm">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[withinList]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={shown.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <Stack gap="sm">
            {shown.map((item) => (
              <SortableRow key={item.id} id={item.id} fixed={item.id === pinnedId}>
                {renderRow(item)}
              </SortableRow>
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {rest > 0 && !expanded && (
        <Anchor component="button" type="button" size="xs" onClick={() => setExpandedAt(limit)}>
          {moreLabel(rest)}
        </Anchor>
      )}
      {expanded && ordered.length > limit && (
        <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => setExpandedAt(null)}>
          Свернуть
        </Anchor>
      )}
    </Stack>
  );
}

/**
 * Одна строка. Ручка занимает всю строку, как на дашборде: попасть пальцем в значок 28 px — задача,
 * которую пользователь себе не ставил. Отличие от дашборда одно: строка здесь — ссылка, и щелчок по
 * ней обязан открывать, а не считаться перетаскиванием. Разводит их порог сенсора: четыре пикселя
 * мышью и 200 мс пальцем.
 */
function SortableRow({ id, fixed, children }: { id: string; fixed?: boolean; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: fixed });

  return (
    <Group
      ref={setNodeRef}
      gap={0}
      wrap="nowrap"
      className={isDragging ? `${classes.row} ${classes.dragging}` : classes.row}
      style={{
        // `CSS.Translate`, а не `CSS.Transform`: второй кладёт в трансформацию ещё и масштаб, когда
        // перетаскиваемая строка и цель разной высоты, и строка раздувалась бы под размер соседней.
        transform: CSS.Translate.toString(transform),
        transition,
        cursor: fixed ? undefined : 'grab',
      }}
      {...(fixed ? {} : attributes)}
      {...(fixed ? {} : listeners)}
    >
      {children}
    </Group>
  );
}
