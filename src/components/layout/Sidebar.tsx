import type { PointerEvent as ReactPointerEvent } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, Box, Divider, Group, ScrollArea, Stack, Text, ThemeIcon, Tooltip, UnstyledButton } from "@mantine/core";
import {
  IconArticle,
  IconBook2,
  IconVocabulary,
  IconBooks,
  IconCalculator,
  IconCalendarStats,
  IconFileText,
  IconGripVertical,
  IconLayoutDashboard,
  IconSunHigh,
  IconLayoutKanban,
  IconMicroscope,
  IconNews,
  IconNotes,
  IconPill,
  IconUsers,
  IconZoomQuestion,
} from "@tabler/icons-react";
import { NavLink, useLocation } from "react-router-dom";

import classes from "./Sidebar.module.css";
import { applyStoredOrder, useSidebarOrder, type SidebarSection } from "./useSidebarOrder";
import { useAuth } from "../../features/auth/AuthContext";
import { getInitials } from "../../features/patients/utils";

interface NavItemData {
  label: string;
  path: string;
  icon: typeof IconLayoutDashboard;
}

const mainNav: NavItemData[] = [
  { label: "Дашборд", path: "/dashboard", icon: IconLayoutDashboard },
  { label: "Мой день", path: "/today", icon: IconSunHigh },
  { label: "Анализы", path: "/analyzer", icon: IconMicroscope },
  { label: "Калькуляторы", path: "/calculators", icon: IconCalculator },
  { label: "Лекарственные препараты", path: "/drugs", icon: IconPill },
  { label: "Планер", path: "/planner", icon: IconLayoutKanban },
  { label: "Заметки", path: "/notes", icon: IconNotes },
  { label: "Календарь", path: "/calendar", icon: IconCalendarStats },
  { label: "Пациенты", path: "/patients", icon: IconUsers },
  { label: "Документы", path: "/documents", icon: IconFileText },
];

const knowledgeNav: NavItemData[] = [
  { label: "Новости медицины", path: "/news", icon: IconNews },
  { label: "Клинические рекомендации", path: "/guidelines", icon: IconBook2 },
  { label: "Справочник", path: "/reference", icon: IconVocabulary },
  { label: "Статьи", path: "/articles", icon: IconArticle },
  { label: "Диагностика", path: "/diagnostics", icon: IconZoomQuestion },
  { label: "Библиотека", path: "/library", icon: IconBooks },
];

/** Nav items whose section stays highlighted on any sub-route (viewing/editing an item, "/new"...),
 * not just their own exact path. */
const STARTS_WITH_NAV_PATHS = new Set([
  "/calculators",
  "/drugs",
  "/notes",
  "/diagnostics",
  "/library",
  "/documents",
  "/guidelines",
  "/articles",
  "/news",
]);

function NavItem({ item, onNavigate, iconOnly }: { item: NavItemData; onNavigate?: () => void; iconOnly?: boolean }) {
  const location = useLocation();
  const active = STARTS_WITH_NAV_PATHS.has(item.path)
    ? location.pathname.startsWith(item.path)
    : location.pathname === item.path;

  const icon = (
    <ThemeIcon variant={active ? "filled" : "light"} color={active ? "brand" : "gray"} size={32} radius="md">
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
        <Group justify="space-between" wrap="nowrap">
          <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
            {icon}
            <Text size="sm" truncate>
              {item.label}
            </Text>
          </Group>
        </Group>
      )}
    </UnstyledButton>
  );

  if (!iconOnly) return button;
  return (
    <Tooltip label={item.label} position="right" withArrow offset={12}>
      {button}
    </Tooltip>
  );
}

function SortableNavItem({ item, onNavigate }: { item: NavItemData; onNavigate?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Group gap={2} wrap="nowrap" className={classes.navRow}>
        <Box
          {...attributes}
          {...listeners}
          className={classes.dragHandle}
          aria-label={`Изменить порядок: ${item.label}`}
        >
          <IconGripVertical size={14} />
        </Box>
        <NavItem item={item} onNavigate={onNavigate} />
      </Group>
    </div>
  );
}

interface SortableNavSectionProps {
  title: string;
  section: SidebarSection;
  items: NavItemData[];
  onReorder: (section: SidebarSection, paths: string[]) => void;
  onNavigate?: () => void;
  iconOnly?: boolean;
}

function SortableNavSection({ title, section, items, onReorder, onNavigate, iconOnly }: SortableNavSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (iconOnly) {
    return (
      <Stack gap={4} align="center">
        {items.map((item) => (
          <NavItem key={item.path} item={item} onNavigate={onNavigate} iconOnly />
        ))}
      </Stack>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.path === active.id);
    const newIndex = items.findIndex((i) => i.path === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(section, arrayMove(items, oldIndex, newIndex).map((i) => i.path));
  };

  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase" px={8} mb={2}>
        {title}
      </Text>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.path)} strategy={verticalListSortingStrategy}>
          <Stack gap={2}>
            {items.map((item) => (
              <SortableNavItem key={item.path} item={item} onNavigate={onNavigate} />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </Stack>
  );
}

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onStartResize?: (event: ReactPointerEvent) => void;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ onNavigate, collapsed, onStartResize, onToggleCollapsed }: SidebarProps) {
  const { order, setSectionOrder } = useSidebarOrder();
  const user = useAuth();
  const initials = getInitials(user.name);
  const location = useLocation();
  const isProfileActive = location.pathname === "/doctor";

  const orderedMain = applyStoredOrder(mainNav, order.main);
  const orderedKnowledge = applyStoredOrder(knowledgeNav, order.knowledge);

  return (
    <Stack justify="space-between" h="100%" py="md" gap={0} style={{ position: "relative" }}>
      <ScrollArea px={collapsed ? 4 : "sm"} style={{ flex: 1, minHeight: 0 }} type="never" scrollbars="y">
        <Stack gap={collapsed ? "sm" : "xl"} pb="md">
          <SortableNavSection title="Основное" section="main" items={orderedMain} onReorder={setSectionOrder} onNavigate={onNavigate} iconOnly={collapsed} />
          {collapsed && <Divider />}
          <SortableNavSection title="База знаний" section="knowledge" items={orderedKnowledge} onReorder={setSectionOrder} onNavigate={onNavigate} iconOnly={collapsed} />
        </Stack>
      </ScrollArea>

      <Stack gap={4} px="sm" pt="sm" style={{ flexShrink: 0 }}>
        {collapsed ? (
          <Tooltip label={`${user.name} — ${user.role}`} position="right" withArrow offset={12}>
            <UnstyledButton
              component={NavLink}
              to="/doctor"
              onClick={onNavigate}
              className={classes.userBox}
              data-active={isProfileActive || undefined}
              style={{ display: "flex", justifyContent: "center", padding: 8, width: "100%" }}
            >
              <Avatar src={user.avatarDataUrl ?? undefined} radius="md" color="brand" variant="filled">
                {initials}
              </Avatar>
            </UnstyledButton>
          </Tooltip>
        ) : (
          <UnstyledButton
            component={NavLink}
            to="/doctor"
            onClick={onNavigate}
            className={classes.userBox}
            data-active={isProfileActive || undefined}
            style={{ width: "100%" }}
          >
            <Group gap={10} wrap="nowrap">
              <Avatar src={user.avatarDataUrl ?? undefined} radius="md" color="brand" variant="filled">
                {initials}
              </Avatar>
              <Box style={{ overflow: "hidden" }}>
                <Text size="sm" fw={600} truncate>
                  {user.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {user.role}
                </Text>
              </Box>
            </Group>
          </UnstyledButton>
        )}
      </Stack>

      <Box
        className={classes.resizeHandle}
        onPointerDown={onStartResize}
        onDoubleClick={onToggleCollapsed}
        visibleFrom="sm"
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину меню"
        title="Потяните, чтобы изменить ширину. Двойной клик — свернуть/развернуть."
      />
    </Stack>
  );
}
