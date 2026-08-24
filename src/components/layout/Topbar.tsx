import {
  ActionIcon,
  Avatar,
  Box,
  Divider,
  Group,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconMenu2, IconStethoscope } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import { getInitials } from '../../features/patients/utils';
import { HeaderNotifications } from './HeaderNotifications';
import { HeaderSearch } from './HeaderSearch';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onBurgerClick?: () => void;
}

export function Topbar({ title, subtitle, onBurgerClick }: TopbarProps) {
  const user = useAuth();

  return (
    <Box h="100%" px="lg">
      <Group h="100%" justify="space-between" wrap="nowrap" gap="md">
        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          <UnstyledButton component={Link} to="/dashboard">
            <Group gap={10} wrap="nowrap">
              <ThemeIcon
                size={38}
                radius="md"
                variant="gradient"
                gradient={{ from: 'brand.6', to: 'brand.8', deg: 135 }}
              >
                <IconStethoscope size={22} />
              </ThemeIcon>
              <Box visibleFrom="xs">
                <Text fw={700} size="md" lh={1.1}>
                  MedAssist
                </Text>
                <Text size="xs" c="dimmed" lh={1.1}>
                  Ассистент врача
                </Text>
              </Box>
            </Group>
          </UnstyledButton>

          <Divider orientation="vertical" visibleFrom="sm" />

          <ActionIcon
            variant="light"
            color="gray"
            size="lg"
            radius="md"
            hiddenFrom="sm"
            onClick={onBurgerClick}
          >
            <IconMenu2 size={18} />
          </ActionIcon>
        </Group>

        {/* A flex item that can shrink and truncate, not an absolutely-centered box — that
         * ignored how much room the search bar and other header content actually needed, so a
         * long title/subtitle would visually overlap the search field at in-between viewport
         * widths (~1150px) instead of just shrinking. */}
        <Box visibleFrom="sm" style={{ flex: 1, minWidth: 0, textAlign: 'center', overflow: 'hidden' }}>
          <Title order={3} fw={700} lh={1.2} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </Title>
          {subtitle && (
            <Text size="xs" c="dimmed" truncate>
              {subtitle}
            </Text>
          )}
        </Box>

        <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
          <HeaderSearch />
          <HeaderNotifications />
          <UnstyledButton component={Link} to="/doctor" visibleFrom="xs">
            <Group gap={8} wrap="nowrap">
              <Avatar src={user.avatarDataUrl ?? undefined} radius="md" color="brand" variant="filled">
                {getInitials(user.name)}
              </Avatar>
              <Box visibleFrom="sm">
                <Text fw={600} size="sm" lh={1.1}>
                  {user.name}
                </Text>
                <Text size="xs" c="dimmed" lh={1.1}>
                  {user.role}
                </Text>
              </Box>
            </Group>
          </UnstyledButton>
        </Group>
      </Group>
    </Box>
  );
}
