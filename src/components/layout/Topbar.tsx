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
    <Box pos="relative" h="100%" px="lg">
      <Group h="100%" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
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

        <Group gap="sm" wrap="nowrap">
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

      <Box
        pos="absolute"
        top="50%"
        left="50%"
        style={{ transform: 'translate(-50%, -50%)', pointerEvents: 'none', textAlign: 'center' }}
        visibleFrom="sm"
      >
        <Title order={3} fw={700} lh={1.2}>
          {title}
        </Title>
        {subtitle && (
          <Text size="xs" c="dimmed">
            {subtitle}
          </Text>
        )}
      </Box>
    </Box>
  );
}
