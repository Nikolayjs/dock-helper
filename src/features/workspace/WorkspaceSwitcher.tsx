import { useState } from 'react';
import { ActionIcon, Group, Loader, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBuildingHospital, IconCheck, IconChevronDown } from '@tabler/icons-react';

import { useIsMobile } from '../../components/common/useIsMobile';
import { useWorkspaces } from './useWorkspaces';
import { workspaceLabel } from './workspaceApi';

/**
 * Какое рабочее пространство открыто и переход в другое.
 *
 * Показывается, **только когда пространств больше одного**. У врача, работающего одному, их всегда
 * ровно одно, и переключатель был бы органом управления, которым нечего переключать: место в шапке
 * дорогое, а на телефоне его нет вовсе.
 *
 * На узком экране остаётся значок без подписи — по тем же соображениям, по которым там прячется
 * логотип и сворачивается поиск.
 */
export function WorkspaceSwitcher() {
  const { workspaces, switchTo } = useWorkspaces();
  const isMobile = useIsMobile();
  const [switching, setSwitching] = useState<string | null>(null);

  if (workspaces.length < 2) return null;

  const active = workspaces.find((workspace) => workspace.active) ?? workspaces[0];

  const handleSwitch = async (workspaceId: string) => {
    if (workspaceId === active.id) return;
    setSwitching(workspaceId);
    try {
      await switchTo(workspaceId);
      const opened = workspaces.find((workspace) => workspace.id === workspaceId);
      notifications.show({ message: `Открыто: ${opened ? workspaceLabel(opened) : 'другое пространство'}`, color: 'teal' });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Не удалось переключить пространство',
        color: 'red',
      });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <Menu position="bottom-end" width={260} withinPortal>
      <Menu.Target>
        {isMobile ? (
          <Tooltip label={`Пространство: ${workspaceLabel(active)}`}>
            <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Рабочее пространство">
              {switching ? <Loader size={16} /> : <IconBuildingHospital size={20} />}
            </ActionIcon>
          </Tooltip>
        ) : (
          <UnstyledButton aria-label="Рабочее пространство">
            <Group gap={6} wrap="nowrap">
              {switching ? <Loader size={16} /> : <IconBuildingHospital size={18} />}
              <Text size="sm" fw={500} lineClamp={1} maw={160}>
                {workspaceLabel(active)}
              </Text>
              <IconChevronDown size={14} />
            </Group>
          </UnstyledButton>
        )}
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Рабочее пространство</Menu.Label>
        {workspaces.map((workspace) => (
          <Menu.Item
            key={workspace.id}
            onClick={() => void handleSwitch(workspace.id)}
            // Отметка стоит у открытого, а не подсветка: подсветка в меню значит «под курсором».
            leftSection={workspace.active ? <IconCheck size={16} /> : <span style={{ width: 16 }} />}
          >
            <Text size="sm" lineClamp={1}>
              {workspaceLabel(workspace)}
            </Text>
            <Text size="xs" c="dimmed">
              {workspace.accessRole === 'owner' ? 'Вы владелец' : 'Вы участник'}
              {workspace.memberCount > 1 ? ` · врачей: ${workspace.memberCount}` : ''}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
