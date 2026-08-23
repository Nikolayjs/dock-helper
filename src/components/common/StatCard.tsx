import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: Icon;
  color?: string;
  delta?: number;
  deltaLabel?: string;
}

export function StatCard({ label, value, icon: Icon, color = 'brand', delta, deltaLabel }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="sm" c="dimmed" fw={500}>
            {label}
          </Text>
          <Text size="1.6rem" fw={700} mt={4}>
            {value}
          </Text>
        </div>
        <ThemeIcon size={44} radius="md" variant="light" color={color}>
          <Icon size={22} stroke={1.8} />
        </ThemeIcon>
      </Group>

      {delta !== undefined && (
        <Group gap={4} mt="sm">
          <ThemeIcon size={18} radius="sm" variant="light" color={positive ? 'teal' : 'red'}>
            {positive ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
          </ThemeIcon>
          <Text size="xs" fw={600} c={positive ? 'teal' : 'red'}>
            {positive ? '+' : ''}
            {delta}%
          </Text>
          {deltaLabel && (
            <Text size="xs" c="dimmed">
              {deltaLabel}
            </Text>
          )}
        </Group>
      )}
    </Card>
  );
}
