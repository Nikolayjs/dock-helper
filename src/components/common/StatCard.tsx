import { Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: string;
  icon: Icon;
  color?: string;
  delta?: number;
  deltaLabel?: string;
  /** Turns the whole card into a link — use it whenever the number names a list worth opening. */
  to?: string;
  /** One muted line under the number: what it means, or what to do about it. */
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, color = 'brand', delta, deltaLabel, to, hint }: StatCardProps) {
  const positive = (delta ?? 0) >= 0;

  const body = (
    <>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
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

      {hint && (
        <Text size="xs" c="dimmed" mt={delta === undefined ? 'sm' : 4} lineClamp={2}>
          {hint}
        </Text>
      )}
    </>
  );

  if (!to) {
    return (
      <Card withBorder padding="lg">
        {body}
      </Card>
    );
  }

  return (
    // `color: inherit` because Mantine would otherwise paint the whole card in link blue.
    <Card withBorder padding="lg" component={Link} to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      {body}
    </Card>
  );
}
