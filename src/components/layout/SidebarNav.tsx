import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Box, Group, Menu, Stack, Text, TextInput, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconEyeOff,
  IconGripVertical,
  IconPencil,
  IconRotate,
} from '@tabler/icons-react';
import { NavLink, useLocation } from 'react-router-dom';

import classes from './Sidebar.module.css';
import {
  arrangeSidebar,
  labelOf,
  SECTION_TITLES,
  SIDEBAR_SECTIONS,
  type SidebarItem,
  type SidebarLayout,
  type SidebarSection,
} from './useSidebarLayout';

export interface NavItemData extends SidebarItem {
  icon: typeof IconGripVertical;
}

/** Разделы, которые остаются подсвеченными на любом внутреннем адресе — карточке, правке, «новом». */
const STARTS_WITH_NAV_PATHS = new Set([
  '/calculators',
  '/drugs',
  '/notes',
  '/diagnostics',
  '/library',
  '/documents',
  '/guidelines',
  '/articles',
  '/news',
]);

function useIsActive(path: string): boolean {
  const location = useLocation();
  return STARTS_WITH_NAV_PATHS.has(path) ? location.pathname.startsWith(path) : location.pathname === path;
}

function NavLinkButton({
  item,
  label,
  onNavigate,
  iconOnly,
}: {
  item: NavItemData;
  label: string;
  onNavigate?: () => void;
  iconOnly?: boolean;
}) {
  const active = useIsActive(item.path);

  const icon = (
    <ThemeIcon variant={active ? 'filled' : 'light'} color={active ? 'brand' : 'gray'} size={32} radius="md">
      <item.icon size={18} stroke={1.8} />
    </ThemeIcon>
  );

  const button = (
    <UnstyledButton
      component={NavLink}
      to={item.path}
      className={classes.navItem}
      data-active={active || undefined}
      data-icon-only={iconOnly || undefined}
      onClick={onNavigate}
      style={{ flex: 1, minWidth: 0 }}
    >
      {iconOnly ? (
        <Group justify="center">{icon}</Group>
      ) : (
        <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
          {icon}
          <Text size="sm" truncate>
            {label}
          </Text>
        </Group>
      )}
    </UnstyledButton>
  );

  if (!iconOnly) return button;
  return (
    <Tooltip label={label} position="right" withArrow offset={12}>
      {button}
    </Tooltip>
  );
}

interface RowProps {
  item: NavItemData;
  label: string;
  section: SidebarSection;
  renamed: boolean;
  onNavigate?: () => void;
  onRename: (path: string, label: string) => void;
  onMove: (path: string, to: SidebarSection) => void;
}

function SortableNavRow({ item, label, section, renamed, onNavigate, onRename, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.path });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const input = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => setDraft(label), [label]);

  /*
   * Фокус ставится следующим кадром, а закрытие по `blur` не срабатывает, пока фокуса не было.
   *
   * Переименование открывается из меню строки, а Mantine, закрывая меню, **возвращает фокус на
   * кнопку** — поле успевало открыться, потерять фокус и закрыться в тот же кадр. Со стороны это
   * выглядело так, будто пункт «Переименовать» не работает вовсе.
   */
  useEffect(() => {
    if (!editing) {
      focused.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const commit = () => {
    setEditing(false);
    // Имя, совпавшее с заводским, — это отказ от своего, а не своё такое же: иначе пункт считался бы
    // переименованным, а меню — настроенным, ничем этого не показывая.
    onRename(item.path, draft.trim() === item.label ? '' : draft);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Group gap={2} wrap="nowrap" className={classes.navRow}>
        <Box {...attributes} {...listeners} className={classes.dragHandle} aria-label={`Переставить: ${label}`}>
          <IconGripVertical size={14} />
        </Box>

        {editing ? (
          <TextInput
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onFocus={() => {
              focused.current = true;
            }}
            onBlur={() => {
              if (focused.current) commit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(label);
                setEditing(false);
              }
            }}
            size="xs"
            aria-label={`Название пункта: ${label}`}
            style={{ flex: 1, minWidth: 0 }}
          />
        ) : (
          <NavLinkButton item={item} label={label} onNavigate={onNavigate} />
        )}

        {/*
          Место под меню занято всегда, даже когда оно не видно: появляясь из ниоткуда, кнопка
          сдвигала бы название ровно в тот момент, когда на него наводят. Та же причина, по которой
          в таблице всегда занято место под стрелку сортировки.
        */}
        <Menu position="bottom-end" withinPortal shadow="md" width={210}>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              className={classes.rowMenu}
              aria-label={`Настроить пункт: ${label}`}
            >
              <IconDotsVertical size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => setEditing(true)}>
              Переименовать
            </Menu.Item>
            {renamed && (
              <Menu.Item leftSection={<IconRotate size={14} />} onClick={() => onRename(item.path, '')}>
                Вернуть название
              </Menu.Item>
            )}
            <Menu.Divider />
            {SIDEBAR_SECTIONS.filter((target) => target !== section).map((target) => (
              <Menu.Item
                key={target}
                leftSection={target === 'more' ? <IconEyeOff size={14} /> : undefined}
                onClick={() => onMove(item.path, target)}
              >
                {target === 'more' ? 'Убрать в «Ещё»' : `Перенести в «${SECTION_TITLES[target]}»`}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Group>
    </div>
  );
}

function SectionBlock({
  section,
  items,
  layout,
  collapsedSection,
  onToggle,
  onNavigate,
  onRename,
  onMove,
}: {
  section: SidebarSection;
  items: NavItemData[];
  layout: SidebarLayout;
  collapsedSection: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  onRename: (path: string, label: string) => void;
  onMove: (path: string, to: SidebarSection) => void;
}) {
  // Область сброса нужна самому разделу, а не только его строкам: в пустой «Ещё» иначе не попасть.
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section}` });

  return (
    <Stack gap={4}>
      <UnstyledButton onClick={onToggle} className={classes.sectionTitle} aria-expanded={!collapsedSection}>
        <Group gap={4} wrap="nowrap">
          {collapsedSection ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {SECTION_TITLES[section]}
          </Text>
          {collapsedSection && (
            <Text size="xs" c="dimmed">
              {items.length}
            </Text>
          )}
        </Group>
      </UnstyledButton>

      {!collapsedSection && (
        <SortableContext items={items.map((i) => i.path)} strategy={verticalListSortingStrategy}>
          <Stack
            ref={setNodeRef}
            gap={2}
            mih={items.length === 0 ? 36 : undefined}
            className={classes.sectionDrop}
            data-over={isOver || undefined}
          >
            {items.map((item) => (
              <SortableNavRow
                key={item.path}
                item={item}
                label={labelOf(item, layout)}
                section={section}
                renamed={Boolean(layout.labels[item.path])}
                onNavigate={onNavigate}
                onRename={onRename}
                onMove={onMove}
              />
            ))}
            {items.length === 0 && (
              <Text size="xs" c="dimmed" px={8} py={6}>
                Перетащите сюда
              </Text>
            )}
          </Stack>
        </SortableContext>
      )}
    </Stack>
  );
}

interface SidebarNavProps {
  items: NavItemData[];
  layout: SidebarLayout;
  iconOnly?: boolean;
  onNavigate?: () => void;
  onArrange: (arrangement: Record<SidebarSection, { path: string }[]>) => void;
  onRename: (path: string, label: string) => void;
  onToggleSection: (section: SidebarSection) => void;
}

/**
 * Пункты меню: три раздела, перетаскивание между ними, свои названия.
 *
 * Один `DndContext` на все разделы, а не по одному на каждый: пункт должен переезжать из
 * «Основного» в «Ещё», а раздельные контексты этого не умеют — они и были причиной, по которой
 * порядок раньше менялся только внутри своего раздела.
 */
export function SidebarNav({
  items,
  layout,
  iconOnly,
  onNavigate,
  onArrange,
  onRename,
  onToggleSection,
}: SidebarNavProps) {
  const stored = useMemo(() => arrangeSidebar(items, layout), [items, layout]);
  const [arrangement, setArrangement] = useState(stored);
  const dragging = useRef(false);
  const [activePath, setActivePath] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging.current) setArrangement(stored);
  }, [stored]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionOf = (path: string, from: Record<SidebarSection, NavItemData[]>): SidebarSection | undefined =>
    SIDEBAR_SECTIONS.find((section) => from[section].some((item) => item.path === path));

  /** Чистый перенос: из какого раздела бы ни был пункт, он оказывается в целевом на своём месте. */
  const moved = (
    prev: Record<SidebarSection, NavItemData[]>,
    path: string,
    to: SidebarSection,
    index?: number,
  ): Record<SidebarSection, NavItemData[]> => {
    const from = sectionOf(path, prev);
    const item = from && prev[from].find((i) => i.path === path);
    if (!item) return prev;
    const next: Record<SidebarSection, NavItemData[]> = {
      main: prev.main.filter((i) => i.path !== path),
      knowledge: prev.knowledge.filter((i) => i.path !== path),
      more: prev.more.filter((i) => i.path !== path),
    };
    const target = [...next[to]];
    target.splice(index ?? target.length, 0, item);
    next[to] = target;
    return next;
  };

  /** Куда попадёт пункт, отпущенный над `overId`: над строкой — на её место, над разделом — в конец. */
  const dropTarget = (overId: string, from: Record<SidebarSection, NavItemData[]>) => {
    if (overId.startsWith('section:')) {
      return { section: overId.slice('section:'.length) as SidebarSection, index: undefined };
    }
    const section = sectionOf(overId, from);
    if (!section) return null;
    const index = from[section].findIndex((i) => i.path === overId);
    return { section, index: index === -1 ? undefined : index };
  };

  const handleDragStart = (event: DragStartEvent) => {
    dragging.current = true;
    setActivePath(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const target = dropTarget(String(over.id), arrangement);
    if (!target) return;
    // Перестановка внутри раздела делается на отпускании: иначе строки перескакивают под курсором.
    if (sectionOf(String(active.id), arrangement) === target.section) return;
    setArrangement((prev) => moved(prev, String(active.id), target.section, target.index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    dragging.current = false;
    setActivePath(null);
    const { active, over } = event;
    const target = over ? dropTarget(String(over.id), arrangement) : null;
    const next = target ? moved(arrangement, String(active.id), target.section, target.index) : arrangement;
    setArrangement(next);
    onArrange(next);
  };

  if (iconOnly) {
    // Свёрнутая полоса — только значки: ни перетаскивания, ни меню, ни заголовков разделов. Убранное
    // в «Ещё» показывается здесь же: полоса из значков и так короткая, а прятать в ней нечего.
    return (
      <Stack gap="sm" align="center">
        {SIDEBAR_SECTIONS.map((section) =>
          arrangement[section].length === 0 ? null : (
            <Stack key={section} gap={4} align="center">
              {arrangement[section].map((item) => (
                <NavLinkButton key={item.path} item={item} label={labelOf(item, layout)} onNavigate={onNavigate} iconOnly />
              ))}
            </Stack>
          ),
        )}
      </Stack>
    );
  }

  const active = activePath
    ? SIDEBAR_SECTIONS.flatMap((s) => arrangement[s]).find((i) => i.path === activePath)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Stack gap="xl">
        {SIDEBAR_SECTIONS.map((section) =>
          // «Ещё» показывается, только когда в нём что-то есть: пустой раздел ничего не сообщает.
          // Но во время перетаскивания он нужен всегда — иначе убрать пункт было бы некуда.
          section === 'more' && arrangement.more.length === 0 && activePath === null ? null : (
            <SectionBlock
              key={section}
              section={section}
              items={arrangement[section]}
              layout={layout}
              collapsedSection={layout.collapsed.includes(section) && activePath === null}
              onToggle={() => onToggleSection(section)}
              onNavigate={onNavigate}
              onRename={onRename}
              onMove={(path, to) => {
                const next = moved(arrangement, path, to);
                setArrangement(next);
                onArrange(next);
              }}
            />
          ),
        )}
      </Stack>

      {/* Перетаскиваемый пункт рисуется поверх: без этого он исчезает, уходя в свёрнутый раздел. */}
      <DragOverlay>
        {active ? (
          <Box className={classes.dragGhost}>
            <NavLinkButton item={active} label={labelOf(active, layout)} />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
