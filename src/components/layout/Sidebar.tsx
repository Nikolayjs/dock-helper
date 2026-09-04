import type { PointerEvent as ReactPointerEvent } from "react";
import { Avatar, Box, Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import {
  IconInbox,
  IconArticle,
  IconBuildingStore,
  IconVocabulary,
  IconBooks,
  IconCalculator,
  IconCalendarStats,
  IconFileText,
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
import { Tooltip } from "@mantine/core";

import classes from "./Sidebar.module.css";
import { SidebarNav, type NavItemData } from "./SidebarNav";
import { useSidebarLayout } from "./useSidebarLayout";
import { useAuth } from "../../features/auth/AuthContext";
import { getInitials } from "../../features/patients/utils";

/**
 * Пункты меню и раздел, в котором каждый лежит **по умолчанию**.
 *
 * Дальше раскладку определяет врач: пункт можно переставить, перенести в другой раздел и убрать в
 * «Ещё». Заводское разбиение остаётся тем, с чего начинают, и тем, куда возвращает «Сбросить».
 */
const NAV_ITEMS: NavItemData[] = [
  { label: "Дашборд", path: "/dashboard", icon: IconLayoutDashboard, section: "main" },
  { label: "Мой день", path: "/today", icon: IconSunHigh, section: "main" },
  { label: "Анализы", path: "/analyzer", icon: IconMicroscope, section: "main" },
  { label: "Калькуляторы", path: "/calculators", icon: IconCalculator, section: "main" },
  { label: "Лекарственные препараты", path: "/drugs", icon: IconPill, section: "main" },
  { label: "Планер", path: "/planner", icon: IconLayoutKanban, section: "main" },
  { label: "Заметки", path: "/notes", icon: IconNotes, section: "main" },
  { label: "Календарь", path: "/calendar", icon: IconCalendarStats, section: "main" },
  { label: "Пациенты", path: "/patients", icon: IconUsers, section: "main" },
  { label: "Документы", path: "/documents", icon: IconFileText, section: "main" },
  { label: "Магазин", path: "/store", icon: IconBuildingStore, section: "main" },
  { label: "Новости медицины", path: "/news", icon: IconNews, section: "knowledge" },
  { label: "Справочник", path: "/reference", icon: IconVocabulary, section: "knowledge" },
  { label: "Статьи", path: "/articles", icon: IconArticle, section: "knowledge" },
  { label: "Входящие", path: "/inbox", icon: IconInbox, section: "knowledge" },
  { label: "Диагностика", path: "/diagnostics", icon: IconZoomQuestion, section: "knowledge" },
  { label: "Библиотека", path: "/library", icon: IconBooks, section: "knowledge" },
];

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onStartResize?: (event: ReactPointerEvent) => void;
  onToggleCollapsed?: () => void;
}

export function Sidebar({ onNavigate, collapsed, onStartResize, onToggleCollapsed }: SidebarProps) {
  const { layout, setStructure, rename, renameFolder, toggle } = useSidebarLayout();
  const user = useAuth();
  const initials = getInitials(user.name);
  const location = useLocation();
  const isProfileActive = location.pathname === "/doctor";

  return (
    <Stack justify="space-between" h="100%" py="md" gap={0} style={{ position: "relative" }}>
      <ScrollArea px={collapsed ? 4 : "sm"} style={{ flex: 1, minHeight: 0 }} type="never" scrollbars="y">
        <Box pb="md">
          <SidebarNav
            items={NAV_ITEMS}
            layout={layout}
            iconOnly={collapsed}
            onNavigate={onNavigate}
            onStructure={setStructure}
            onRename={rename}
            onRenameFolder={renameFolder}
            onToggle={toggle}
          />
        </Box>
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
