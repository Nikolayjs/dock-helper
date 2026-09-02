import { Anchor, Box, Button, Group, Text } from '@mantine/core';
import { IconFlask } from '@tabler/icons-react';

import { useLogout } from '../auth/AuthContext';
import { isDemoSession } from './demoSession';

/**
 * Постоянная полоса поверх приложения в гостевой сессии.
 *
 * Постоянная, а не закрываемая: демо выглядит как настоящее рабочее место, и врач, набравший в нём
 * настоящую фамилию, должен видеть предупреждение в ту секунду, когда он это делает, а не помнить
 * его с первой страницы.
 */
export function DemoBanner() {
  const logout = useLogout();
  if (!isDemoSession()) return null;

  return (
    <Box
      py={6}
      px="md"
      style={{
        backgroundColor: 'var(--mantine-color-orange-light)',
        borderBottom: '1px solid var(--mantine-color-orange-outline)',
      }}
    >
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap={8} wrap="nowrap">
          <IconFlask size={16} />
          <Text size="sm" fw={500}>
            Демо-режим: данные вымышлены и не сохраняются.
          </Text>
          <Text size="sm" c="dimmed" visibleFrom="sm">
            Закроете вкладку — всё исчезнет.
          </Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          <Anchor href="/" size="sm" visibleFrom="sm">
            О продукте
          </Anchor>
          {/*
            Основное действие в демо — завести аккаунт, и до этого его в полосе не было вовсе:
            гостю, которому продукт понравился, предлагалось только выйти. Ссылка обычная, а не
            через роутер: регистрация живёт в другом роутере, это полная загрузка страницы.
          */}
          <Button size="compact-sm" component="a" href="/login?mode=register">
            Завести аккаунт
          </Button>
          <Button size="compact-sm" variant="subtle" color="orange" onClick={logout}>
            Выйти из демо
          </Button>
        </Group>
      </Group>
    </Box>
  );
}
