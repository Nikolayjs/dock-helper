import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { Anchor, Stack } from '@mantine/core';

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

  /*
   * Когда перетаскивание закончилось. Нужно, чтобы погасить щелчок, который браузер шлёт следом.
   *
   * Строка — ссылка, и после отпускания мыши браузер честно считает, что по ней кликнули: указатель
   * опустился и поднялся на том же `<a>`. Замер: сдвиг на 12 px и обратно уводил на страницу
   * калькулятора, **перезагружая приложение целиком** — переход шёл мимо роутера, а вместе с ним
   * терялось происхождение `state={{ from: '/dashboard' }}`, и кнопка «назад» предлагала «К списку
   * калькуляторов» вместо «На дашборд». Две жалобы, одна причина.
   *
   * Отметка временем, а не флагом: флаг, выставленный перетаскиванием, закончившимся не на ссылке,
   * остался бы висеть и съел бы следующий честный щелчок.
   */
  const draggedAt = useRef(0);
  /**
   * Отменяет переход по ссылке, если щелчок прилетел следом за перетаскиванием.
   *
   * **Слушатель на документе, а не обработчик в разметке, и это несущее.** dnd-kit после
   * перетаскивания сам гасит распространение щелчка, чтобы тот не дошёл до приложения, — но
   * действие по умолчанию не отменяет. В итоге React о щелчке не узнаёт (проверено: ни
   * `onClickCapture` на строке, ни `onClick` на самой ссылке не вызывались ни разу), а браузер
   * послушно переходит по `href` — **мимо роутера, с полной перезагрузкой**. Вместе с ней теряется
   * `state={{ from: '/dashboard' }}`, и кнопка «назад» предлагает «К списку калькуляторов» вместо
   * «На дашборд». Обе жалобы врача — про это одно.
   *
   * Слушатель ставится на погружении и один раз при монтировании: свои слушатели dnd-kit заводит
   * на время перетаскивания, то есть позже, а на одной цели порядок вызова — порядок регистрации.
   * Значит, наш успевает первым и отменяет переход прежде, чем dnd-kit оборвёт распространение.
   *
   * Отметка временем, а не флагом: флаг от перетаскивания, закончившегося не на ссылке, остался бы
   * висеть и съел бы следующий честный щелчок. Модификаторы пропускаются — «открыть в новой
   * вкладке» перетаскиванием не бывает.
   */
  useEffect(() => {
    const cancelAfterDrag = (event: MouseEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
      if (Date.now() - draggedAt.current > 250) return;
      event.preventDefault();
    };
    document.addEventListener('click', cancelAfterDrag, true);
    return () => document.removeEventListener('click', cancelAfterDrag, true);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    draggedAt.current = Date.now();
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
        // Отмена (клавиша Esc, отпускание вне списка) тоже заканчивается щелчком по ссылке.
        onDragCancel={() => {
          draggedAt.current = Date.now();
        }}
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
function SortableRow({
  id,
  fixed,
  children,
}: {
  id: string;
  fixed?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: fixed });


  /*
   * Обычный `div`, а не `Group` из Mantine, и это не вкус.
   *
   * `Group` — полиморфная обёртка со своей обработкой пропсов, и обработчики на погружении
   * (`onClickCapture`, `onDragStartCapture`) до разметки не доходили: замер показал, что
   * `onDragEnd` у dnd-kit срабатывает, а `swallowClick` — ни разу. Раскладку задаёт класс.
   */
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? `${classes.row} ${classes.dragging}` : classes.row}
      /*
       * Гасим **родное** перетаскивание браузера. Ссылку Chromium умеет таскать сам, и, отпустив
       * её над страницей, переходит по ней — минуя роутер, с полной перезагрузкой.
       *
       * Найдено замером: после сдвига на 12 px события `click` не было вовсе, зато была
       * перезагрузка и потеря `state={{ from: '/dashboard' }}`, из-за чего кнопка «назад»
       * предлагала «К списку калькуляторов» вместо «На дашборд». Обе жалобы врача — про это.
       *
       * `onDragStartCapture`, а не `draggable={false}` на самой ссылке: строку рисует карточка
       * через `renderRow`, и запрет должен действовать на что угодно внутри неё.
       */
      onDragStartCapture={(event: React.DragEvent) => event.preventDefault()}
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
    </div>
  );
}
