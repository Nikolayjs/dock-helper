import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';

/** The heading every dashboard card wears: name, one line of context, and an optional control. */
export function CardHeading({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) {
  return (
    <Group justify="space-between" mb="md" wrap="wrap" gap="sm">
      <div>
        <Text fw={600}>{title}</Text>
        {caption && (
          <Text size="sm" c="dimmed">
            {caption}
          </Text>
        )}
      </div>
      {action}
    </Group>
  );
}
