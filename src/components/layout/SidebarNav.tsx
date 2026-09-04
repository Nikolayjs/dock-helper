import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  type DragMoveEvent,
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
  IconFolder,
  IconFolderOff,
  IconFolderPlus,
  IconGripVertical,
  IconPencil,
  IconRotate,
} from '@tabler/icons-react';
import { NavLink, useLocation } from 'react-router-dom';

import classes from './Sidebar.module.css';
import {
  arrangeSidebar,
  folderKey,
  FOLDER_PREFIX,
  isFolderId,
  labelOf,
  SECTION_TITLES,
  SIDEBAR_SECTIONS,
  toStructure,
  type SidebarEntry,
  type SidebarItem,
  type SidebarLayout,
  type SidebarSection,
  type SidebarStructure,
} from './useSidebarLayout';

export interface NavItemData extends SidebarItem {
  icon: typeof IconGripVertical;
}

type Entry = SidebarEntry<NavItemData>;
type Arranged = Record<SidebarSection, Entry[]>;

/** Разделы, которые остаются подсвеченными на любом внутреннем адресе — карточке, правке, «новом». */
const STARTS_WITH_NAV_PATHS = new Set([
  '/calculators',
  '/drugs',
  '/notes',
  '/diagnostics',
  '/library',
  '/documents',
  '/reference',
  '/articles',
  '/news',
]);

/**
 * Чужие адреса, на которых раздел всё равно подсвечен.
 *
 * У справочника три вкладки ведут наружу, на свои страницы: карточка кода `/icd10/:code`, карточка
 * заболевания и клиническая рекомендация `/guidelines/:id` — документ на двести тысяч знаков,
 * вкладкой быть не может. Без этого врач, открывший рекомендацию, видел в меню подсветку нигде и
 * терял ответ на вопрос «где я»: раздела «Клинические рекомендации» больше нет, а справочник, из
 * которого он пришёл, не отмечен.
 */
const NAV_ALIASES: Record<string, string[]> = {
  '/reference': ['/guidelines/', '/icd10/'],
};

function matches(pathname: string, path: string): boolean {
  if ((NAV_ALIASES[path] ?? []).some((alias) => pathname.startsWith(alias))) return true;
  return STARTS_WITH_NAV_PATHS.has(path) ? pathname.startsWith(path) : pathname === path;
}

/* ─── где что лежит и как это подвинуть ──────────────────────────────────────────────────────── */

interface Spot {
  section: SidebarSection;
  /** Место строки в разделе. */
  index: number;
  /** Если пункт лежит внутри папки — её `id` и место внутри неё. */
  folderId?: string;
  inner?: number;
}

function locate(arranged: Arranged, id: string): Spot | null {
  for (const section of SIDEBAR_SECTIONS) {
    const entries = arranged[section];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.kind === 'item' && entry.item.path === id) return { section, index };
      if (entry.kind === 'folder') {
        if (folderKey(entry.folder.id) === id) return { section, index };
        const inner = entry.items.findIndex((item) => item.path === id);
        if (inner !== -1) return { section, index, folderId: entry.folder.id, inner };
      }
    }
  }
  return null;
}

function findItem(arranged: Arranged, path: string): NavItemData | null {
  for (const section of SIDEBAR_SECTIONS) {
    for (const entry of arranged[section]) {
      if (entry.kind === 'item' && entry.item.path === path) return entry.item;
      if (entry.kind === 'folder') {
        const found = entry.items.find((item) => item.path === path);
        if (found) return found;
      }
    }
  }
  return null;
}

function findFolder(arranged: Arranged, id: string): Extract<Entry, { kind: 'folder' }> | null {
  for (const section of SIDEBAR_SECTIONS) {
    for (const entry of arranged[section]) {
      if (entry.kind === 'folder' && entry.folder.id === id) return entry;
    }
  }
  return null;
}

const clone = (arranged: Arranged): Arranged => ({
  main: arranged.main.map((e) => (e.kind === 'folder' ? { ...e, items: [...e.items] } : e)),
  knowledge: arranged.knowledge.map((e) => (e.kind === 'folder' ? { ...e, items: [...e.items] } : e)),
  more: arranged.more.map((e) => (e.kind === 'folder' ? { ...e, items: [...e.items] } : e)),
});

/**
 * Убирает строку отовсюду: из разделов и из папок.
 *
 * Папка, оставшаяся пустой, исчезает вместе с последним пунктом: имя без единой двери за ним ничего
 * не открывает.
 */
function detach(arranged: Arranged, id: string): Arranged {
  const next = clone(arranged);
  for (const section of SIDEBAR_SECTIONS) {
    next[section] = next[section]
      .filter(
        (entry) =>
          !(entry.kind === 'item' && entry.item.path === id) &&
          !(entry.kind === 'folder' && folderKey(entry.folder.id) === id),
      )
      .map((entry) => (entry.kind === 'folder' ? { ...entry, items: entry.items.filter((item) => item.path !== id) } : entry))
      .filter((entry) => entry.kind !== 'folder' || entry.items.length > 0);
  }
  return next;
}

/* ─── строки ─────────────────────────────────────────────────────────────────────────────────── */

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
  const { pathname } = useLocation();
  const active = matches(pathname, item.path);

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

/**
 * Название, которое правится на месте: у пункта и у папки оно правится одинаково.
 *
 * Фокус ставится следующим кадром, а закрытие по `blur` не срабатывает, пока фокуса не было:
 * переименование открывается из меню строки, а Mantine, закрывая меню, **возвращает фокус на
 * кнопку** — поле успевало открыться, потерять фокус и закрыться в тот же кадр, и со стороны это
 * выглядело так, будто «Переименовать» не работает вовсе.
 */
function InlineName({
  value,
  onCommit,
  onCancel,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <TextInput
      ref={input}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        if (focused.current) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(draft);
        if (e.key === 'Escape') onCancel();
      }}
      size="xs"
      aria-label={ariaLabel}
      style={{ flex: 1, minWidth: 0 }}
    />
  );
}

function RowMenu({
  label,
  section,
  onRename,
  onResetName,
  onMove,
  extra,
}: {
  label: string;
  section: SidebarSection;
  onRename: () => void;
  onResetName?: () => void;
  onMove: (to: SidebarSection) => void;
  extra?: ReactNode;
}) {
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={220}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" className={classes.rowMenu} aria-label={`Настроить пункт: ${label}`}>
          <IconDotsVertical size={14} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={14} />} onClick={onRename}>
          Переименовать
        </Menu.Item>
        {onResetName && (
          <Menu.Item leftSection={<IconRotate size={14} />} onClick={onResetName}>
            Вернуть название
          </Menu.Item>
        )}
        {extra}
        <Menu.Divider />
        {SIDEBAR_SECTIONS.filter((target) => target !== section).map((target) => (
          <Menu.Item
            key={target}
            leftSection={target === 'more' ? <IconEyeOff size={14} /> : undefined}
            onClick={() => onMove(target)}
          >
            {target === 'more' ? 'Убрать в «Ещё»' : `Перенести в «${SECTION_TITLES[target]}»`}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

function ItemRow({
  item,
  label,
  section,
  renamed,
  inFolder,
  combine,
  editing,
  onNavigate,
  onStartEdit,
  onRename,
  onMove,
  onWrap,
  onUnwrap,
}: {
  item: NavItemData;
  label: string;
  section: SidebarSection;
  renamed: boolean;
  inFolder: boolean;
  combine: boolean;
  editing: boolean;
  onNavigate?: () => void;
  onStartEdit: () => void;
  onRename: (path: string, label: string) => void;
  onMove: (path: string, to: SidebarSection) => void;
  onWrap: (path: string) => void;
  onUnwrap: (path: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.path });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <Group gap={2} wrap="nowrap" className={classes.navRow} data-combine={combine || undefined}>
        <Box {...attributes} {...listeners} className={classes.dragHandle} aria-label={`Переставить: ${label}`}>
          <IconGripVertical size={14} />
        </Box>

        {editing ? (
          <InlineName
            value={label}
            ariaLabel={`Название пункта: ${label}`}
            onCommit={(next) => onRename(item.path, next.trim() === item.label ? '' : next)}
            onCancel={() => onRename(item.path, renamed ? label : '')}
          />
        ) : (
          <NavLinkButton item={item} label={label} onNavigate={onNavigate} />
        )}

        {/* Значок на строке, над которой держат другую: он и объясняет, что получится папка. */}
        {combine && (
          <ThemeIcon size={20} radius="sm" variant="light" color="brand" style={{ flexShrink: 0 }}>
            <IconFolderPlus size={12} />
          </ThemeIcon>
        )}

        <RowMenu
          label={label}
          section={section}
          onRename={onStartEdit}
          onResetName={renamed ? () => onRename(item.path, '') : undefined}
          onMove={(to) => onMove(item.path, to)}
          extra={
            inFolder ? (
              <Menu.Item leftSection={<IconFolderOff size={14} />} onClick={() => onUnwrap(item.path)}>
                Вынести из папки
              </Menu.Item>
            ) : (
              <Menu.Item leftSection={<IconFolderPlus size={14} />} onClick={() => onWrap(item.path)}>
                В новую папку
              </Menu.Item>
            )
          }
        />
      </Group>
    </div>
  );
}

function FolderRow({
  entry,
  section,
  layout,
  collapsed,
  combine,
  editing,
  editingKey,
  onNavigate,
  onToggle,
  onStartEdit,
  onRenameFolder,
  onRename,
  onMove,
  onDissolve,
  onUnwrap,
}: {
  entry: Extract<Entry, { kind: 'folder' }>;
  section: SidebarSection;
  layout: SidebarLayout;
  collapsed: boolean;
  combine: boolean;
  editing: boolean;
  editingKey: string | null;
  onNavigate?: () => void;
  onToggle: () => void;
  onStartEdit: (key: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onRename: (path: string, label: string) => void;
  onMove: (id: string, to: SidebarSection) => void;
  onDissolve: (id: string) => void;
  onUnwrap: (path: string) => void;
}) {
  const id = folderKey(entry.folder.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Своя область сброса: в свёрнутую папку иначе не положить.
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `into:${entry.folder.id}` });
  const { pathname } = useLocation();
  const holdsActive = entry.items.some((item) => matches(pathname, item.path));

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <Group gap={2} wrap="nowrap" className={classes.navRow} data-combine={combine || isOver || undefined}>
        <Box {...attributes} {...listeners} className={classes.dragHandle} aria-label={`Переставить папку: ${entry.folder.title}`}>
          <IconGripVertical size={14} />
        </Box>

        {editing ? (
          <InlineName
            value={entry.folder.title}
            ariaLabel={`Название папки: ${entry.folder.title}`}
            onCommit={(next) => onRenameFolder(entry.folder.id, next)}
            onCancel={() => onRenameFolder(entry.folder.id, entry.folder.title)}
          />
        ) : (
          <UnstyledButton
            ref={setDropRef}
            onClick={onToggle}
            className={classes.navItem}
            /* Свёрнутая папка с открытым разделом внутри подсвечена: иначе «где я» теряется. */
            data-active={(holdsActive && collapsed) || undefined}
            aria-expanded={!collapsed}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
              <ThemeIcon variant="light" color={holdsActive ? 'brand' : 'gray'} size={32} radius="md">
                <IconFolder size={18} stroke={1.8} />
              </ThemeIcon>
              <Text size="sm" truncate style={{ flex: 1 }}>
                {entry.folder.title}
              </Text>
              {collapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
            </Group>
          </UnstyledButton>
        )}

        <RowMenu
          label={entry.folder.title}
          section={section}
          onRename={() => onStartEdit(id)}
          onMove={(to) => onMove(id, to)}
          extra={
            <Menu.Item leftSection={<IconFolderOff size={14} />} onClick={() => onDissolve(entry.folder.id)}>
              Разгруппировать
            </Menu.Item>
          }
        />
      </Group>

      {!collapsed && (
        <SortableContext items={entry.items.map((i) => i.path)} strategy={verticalListSortingStrategy}>
          <Stack gap={2} className={classes.folderBody}>
            {entry.items.map((item) => (
              <ItemRow
                key={item.path}
                item={item}
                label={labelOf(item, layout)}
                section={section}
                renamed={Boolean(layout.labels[item.path])}
                inFolder
                combine={false}
                editing={editingKey === item.path}
                onNavigate={onNavigate}
                onStartEdit={() => onStartEdit(item.path)}
                onRename={onRename}
                onMove={onMove}
                onWrap={() => undefined}
                onUnwrap={onUnwrap}
              />
            ))}
          </Stack>
        </SortableContext>
      )}
    </div>
  );
}

function SectionBlock({
  section,
  entries,
  layout,
  collapsed,
  combineId,
  editingKey,
  onToggle,
  onNavigate,
  onStartEdit,
  onRename,
  onRenameFolder,
  onMove,
  onWrap,
  onUnwrap,
  onDissolve,
}: {
  section: SidebarSection;
  entries: Entry[];
  layout: SidebarLayout;
  collapsed: boolean;
  combineId: string | null;
  editingKey: string | null;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
  onStartEdit: (key: string) => void;
  onRename: (path: string, label: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onMove: (id: string, to: SidebarSection) => void;
  onWrap: (path: string) => void;
  onUnwrap: (path: string) => void;
  onDissolve: (id: string) => void;
}) {
  // Область сброса нужна самому разделу, а не только его строкам: в пустой раздел иначе не попасть.
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section}` });
  const count = entries.reduce((sum, entry) => sum + (entry.kind === 'item' ? 1 : entry.items.length), 0);
  const sortableIds = entries.map((entry) => (entry.kind === 'item' ? entry.item.path : folderKey(entry.folder.id)));

  return (
    <Stack gap={4}>
      <UnstyledButton onClick={() => onToggle(section)} className={classes.sectionTitle} aria-expanded={!collapsed}>
        <Group gap={4} wrap="nowrap">
          {collapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {SECTION_TITLES[section]}
          </Text>
          {collapsed && (
            <Text size="xs" c="dimmed">
              {count}
            </Text>
          )}
        </Group>
      </UnstyledButton>

      {!collapsed && (
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <Stack
            ref={setNodeRef}
            gap={2}
            mih={entries.length === 0 ? 36 : undefined}
            className={classes.sectionDrop}
            data-over={isOver || undefined}
          >
            {entries.map((entry) =>
              entry.kind === 'item' ? (
                <ItemRow
                  key={entry.item.path}
                  item={entry.item}
                  label={labelOf(entry.item, layout)}
                  section={section}
                  renamed={Boolean(layout.labels[entry.item.path])}
                  inFolder={false}
                  combine={combineId === entry.item.path}
                  editing={editingKey === entry.item.path}
                  onNavigate={onNavigate}
                  onStartEdit={() => onStartEdit(entry.item.path)}
                  onRename={onRename}
                  onMove={onMove}
                  onWrap={onWrap}
                  onUnwrap={onUnwrap}
                />
              ) : (
                <FolderRow
                  key={entry.folder.id}
                  entry={entry}
                  section={section}
                  layout={layout}
                  collapsed={layout.collapsed.includes(folderKey(entry.folder.id))}
                  combine={combineId === folderKey(entry.folder.id)}
                  editing={editingKey === folderKey(entry.folder.id)}
                  editingKey={editingKey}
                  onNavigate={onNavigate}
                  onToggle={() => onToggle(folderKey(entry.folder.id))}
                  onStartEdit={onStartEdit}
                  onRenameFolder={onRenameFolder}
                  onRename={onRename}
                  onMove={onMove}
                  onDissolve={onDissolve}
                  onUnwrap={onUnwrap}
                />
              ),
            )}
            {entries.length === 0 && (
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

/* ─── сам список ─────────────────────────────────────────────────────────────────────────────── */

interface SidebarNavProps {
  items: NavItemData[];
  layout: SidebarLayout;
  iconOnly?: boolean;
  onNavigate?: () => void;
  onStructure: (structure: SidebarStructure) => void;
  onRename: (path: string, label: string) => void;
  onRenameFolder: (id: string, title: string) => void;
  onToggle: (key: string) => void;
}

/**
 * Пункты меню: три раздела, папки внутри них, перетаскивание между всем этим.
 *
 * **Папка заводится перетаскиванием пункта на пункт** — как в Notion. Отличить «поставить рядом» от
 * «вложить» можно только по тому, куда именно наведено: середина строки означает «вложить», края —
 * «рядом». Поэтому намерение считается по вертикали от рамки строки и держится в состоянии — сам
 * `over` в обоих случаях один и тот же и ответа не даёт.
 *
 * **Полоса «вложить» — средняя половина строки.** Попасть в «рядом» должно быть легко: это обычное
 * действие, а заведение папки — редкое, заметное и легко отменяемое.
 *
 * Один `DndContext` на всё: пункт переезжает и между разделами, и в папку, и обратно, а раздельные
 * контексты этого не умеют.
 */
export function SidebarNav({
  items,
  layout,
  iconOnly,
  onNavigate,
  onStructure,
  onRename,
  onRenameFolder,
  onToggle,
}: SidebarNavProps) {
  const stored = useMemo(() => arrangeSidebar(items, layout), [items, layout]);
  const [arranged, setArranged] = useState<Arranged>(stored);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [combineId, setCombineId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setArranged(stored);
  }, [stored]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const persist = (next: Arranged) => {
    setArranged(next);
    onStructure(toStructure(next));
  };

  /** Кладёт строку в раздел на место `index`; `undefined` — в конец. */
  const putInSection = (from: Arranged, id: string, section: SidebarSection, index?: number): Arranged => {
    const folder = isFolderId(id) ? findFolder(from, id.slice(FOLDER_PREFIX.length)) : null;
    const item = isFolderId(id) ? null : findItem(from, id);
    if (!folder && !item) return from;
    const next = detach(from, id);
    const row: Entry = folder ?? { kind: 'item', item: item as NavItemData };
    const list = [...next[section]];
    list.splice(index ?? list.length, 0, row);
    next[section] = list;
    return next;
  };

  /** Кладёт пункт внутрь папки. Папку в папку не вкладываем — уровень один. */
  const putInFolder = (from: Arranged, path: string, folderId: string, index?: number): Arranged => {
    if (isFolderId(path)) return from;
    const item = findItem(from, path);
    if (!item) return from;
    const next = detach(from, path);
    for (const section of SIDEBAR_SECTIONS) {
      next[section] = next[section].map((entry) => {
        if (entry.kind !== 'folder' || entry.folder.id !== folderId) return entry;
        const list = [...entry.items];
        list.splice(index ?? list.length, 0, item);
        return { ...entry, items: list };
      });
    }
    return next;
  };

  /** Заводит папку на месте пункта-цели: сначала он сам, следом принесённый. */
  const wrapTogether = (from: Arranged, targetPath: string, draggedPath: string): Arranged => {
    const spot = locate(from, targetPath);
    const target = findItem(from, targetPath);
    const dragged = findItem(from, draggedPath);
    if (!spot || spot.folderId || !target || !dragged) return from;

    const id = crypto.randomUUID();
    let next = detach(from, draggedPath);
    next = detach(next, targetPath);
    const list = [...next[spot.section]];
    list.splice(Math.min(spot.index, list.length), 0, {
      kind: 'folder',
      folder: { id, title: 'Новая папка', items: [] },
      items: [target, dragged],
    });
    next[spot.section] = list;
    // Папка без имени бесполезна, поэтому её сразу и переименовывают.
    setEditingKey(folderKey(id));
    return next;
  };

  const handleDragStart = (event: DragStartEvent) => {
    dragging.current = true;
    setActiveId(String(event.active.id));
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);
    if (!over || active.id === over.id || isFolderId(activeId)) {
      setCombineId(null);
      return;
    }
    const overId = String(over.id);
    if (overId.startsWith('section:') || overId.startsWith('into:')) {
      setCombineId(null);
      return;
    }
    const dragged = active.rect.current.translated;
    if (!dragged) return;
    const center = dragged.top + dragged.height / 2;
    const inMiddle = center > over.rect.top + over.rect.height * 0.25 && center < over.rect.top + over.rect.height * 0.75;
    const overSpot = locate(arranged, overId);
    // Внутрь пункта, который сам лежит в папке, вкладывать некуда: уровень один.
    setCombineId(inMiddle && overSpot !== null && !overSpot.folderId ? overId : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    dragging.current = false;
    const { active, over } = event;
    const draggedId = String(active.id);
    const combine = combineId;
    setActiveId(null);
    setCombineId(null);
    if (!over) return;
    const overId = String(over.id);

    // Вложить: в существующую папку или в новую, заведённую на месте пункта-цели.
    if (combine === overId) {
      persist(
        isFolderId(overId)
          ? putInFolder(arranged, draggedId, overId.slice(FOLDER_PREFIX.length))
          : wrapTogether(arranged, overId, draggedId),
      );
      return;
    }
    if (overId.startsWith('into:')) {
      persist(putInFolder(arranged, draggedId, overId.slice('into:'.length)));
      return;
    }
    if (overId.startsWith('section:')) {
      persist(putInSection(arranged, draggedId, overId.slice('section:'.length) as SidebarSection));
      return;
    }
    if (draggedId === overId) return;

    const spot = locate(arranged, overId);
    if (!spot) return;
    persist(
      spot.folderId
        ? putInFolder(arranged, draggedId, spot.folderId, spot.inner)
        : putInSection(arranged, draggedId, spot.section, spot.index),
    );
  };

  const moveTo = (id: string, to: SidebarSection) => persist(putInSection(arranged, id, to));

  /** «В новую папку» из меню — дорога для тех, кому перетаскивание неудобно: телефон, клавиатура. */
  const wrapAlone = (path: string) => {
    const spot = locate(arranged, path);
    const item = findItem(arranged, path);
    if (!spot || spot.folderId || !item) return;
    const id = crypto.randomUUID();
    const next = detach(arranged, path);
    const list = [...next[spot.section]];
    list.splice(Math.min(spot.index, list.length), 0, {
      kind: 'folder',
      folder: { id, title: 'Новая папка', items: [] },
      items: [item],
    });
    next[spot.section] = list;
    setEditingKey(folderKey(id));
    persist(next);
  };

  const unwrap = (path: string) => {
    const spot = locate(arranged, path);
    if (!spot) return;
    persist(putInSection(arranged, path, spot.section, spot.index + 1));
  };

  /** Разгруппировать: пункты встают на место папки, папка исчезает. */
  const dissolve = (folderId: string) => {
    const entry = findFolder(arranged, folderId);
    const spot = locate(arranged, folderKey(folderId));
    if (!entry || !spot) return;
    const next = clone(arranged);
    const list = [...next[spot.section]];
    list.splice(spot.index, 1, ...entry.items.map((item) => ({ kind: 'item', item }) as Entry));
    next[spot.section] = list;
    persist(next);
  };

  if (iconOnly) {
    // Свёрнутая полоса — только значки: ни перетаскивания, ни меню, ни папок. Всё, что лежит в
    // папках и в «Ещё», показывается здесь наравне: полоса и так короткая, прятать в ней нечего.
    const flat = SIDEBAR_SECTIONS.flatMap((section) =>
      arranged[section].flatMap((entry) => (entry.kind === 'item' ? [entry.item] : entry.items)),
    );
    return (
      <Stack gap={4} align="center">
        {flat.map((item) => (
          <NavLinkButton key={item.path} item={item} label={labelOf(item, layout)} onNavigate={onNavigate} iconOnly />
        ))}
      </Stack>
    );
  }

  const activeItem = activeId && !isFolderId(activeId) ? findItem(arranged, activeId) : null;
  const activeFolder = activeId && isFolderId(activeId) ? findFolder(arranged, activeId.slice(FOLDER_PREFIX.length)) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <Stack gap="xl">
        {SIDEBAR_SECTIONS.map((section) => {
          // «Ещё» показывается, только когда в нём что-то есть: пустой раздел ничего не сообщает.
          // Во время перетаскивания он нужен всегда — иначе убрать пункт было бы некуда.
          if (section === 'more' && arranged.more.length === 0 && activeId === null) return null;
          return (
            <SectionBlock
              key={section}
              section={section}
              entries={arranged[section]}
              layout={layout}
              collapsed={layout.collapsed.includes(section) && activeId === null}
              combineId={combineId}
              editingKey={editingKey}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onStartEdit={setEditingKey}
              onRename={(path, label) => {
                setEditingKey(null);
                onRename(path, label);
              }}
              onRenameFolder={(id, title) => {
                setEditingKey(null);
                onRenameFolder(id, title);
              }}
              onMove={moveTo}
              onWrap={wrapAlone}
              onUnwrap={unwrap}
              onDissolve={dissolve}
            />
          );
        })}
      </Stack>

      {/* Перетаскиваемая строка рисуется поверх: без этого она исчезает над свёрнутым разделом. */}
      <DragOverlay>
        {activeItem ? (
          <Box className={classes.dragGhost}>
            <NavLinkButton item={activeItem} label={labelOf(activeItem, layout)} />
          </Box>
        ) : activeFolder ? (
          <Box className={classes.dragGhost}>
            <Group gap={10} wrap="nowrap" px={12} py={10}>
              <ThemeIcon variant="light" color="gray" size={32} radius="md">
                <IconFolder size={18} stroke={1.8} />
              </ThemeIcon>
              <Text size="sm" truncate>
                {activeFolder.folder.title}
              </Text>
            </Group>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
