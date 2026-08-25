import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import type { Drug } from './types';

interface DrugCardProps {
  drug: Drug;
  /** How many interaction rules mention this drug — 0 hides the badge. */
  interactionCount: number;
  onOpen: () => void;
}

export function DrugCard({ drug, interactionCount, onOpen }: DrugCardProps) {
  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      h="100%"
      style={{ cursor: 'pointer' }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
          <Text fw={600} lh={1.25}>
            {drug.inn}
          </Text>
          {interactionCount > 0 && (
            <Badge
              size="sm"
              variant="light"
              color="orange"
              leftSection={<IconAlertTriangle size={12} />}
              style={{ flexShrink: 0 }}
            >
              {interactionCount}
            </Badge>
          )}
        </Group>

        {drug.brandNames.length > 0 && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {drug.brandNames.join(', ')}
          </Text>
        )}

        <Group gap={6} wrap="wrap" mt={2}>
          {drug.pharmGroup && (
            <Badge size="xs" variant="light" color="brand" tt="none">
              {drug.pharmGroup}
            </Badge>
          )}
          {drug.atcCode && (
            <Badge size="xs" variant="default" tt="none">
              {drug.atcCode}
            </Badge>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
