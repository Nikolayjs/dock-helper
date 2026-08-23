import { ActionIcon, Badge, Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { KnowledgeDocument } from './types';

interface DocumentCardProps {
  doc: KnowledgeDocument;
  icon: typeof IconEdit;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagClick?: (tag: string) => void;
}

export function DocumentCard({ doc, icon: Icon, onOpen, onEdit, onDelete, onTagClick }: DocumentCardProps) {
  return (
    <Card withBorder padding="md" h="100%" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon variant="light" color="brand" size={32} radius="md">
            <Icon size={17} />
          </ThemeIcon>
          <Text fw={600} size="sm" truncate>
            {doc.title}
          </Text>
        </Group>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" lineClamp={3} mb="sm">
        {doc.summary}
      </Text>

      {doc.tags.length > 0 && (
        <Group gap={6} mb="sm" onClick={(e) => e.stopPropagation()}>
          {doc.tags.map((tag) => (
            <Badge
              key={tag}
              size="xs"
              variant="light"
              color="gray"
              style={onTagClick ? { cursor: 'pointer' } : undefined}
              onClick={() => onTagClick?.(tag)}
            >
              {tag}
            </Badge>
          ))}
        </Group>
      )}

      <Group justify="space-between">
        <Text size="xs" c="dimmed" truncate style={{ maxWidth: '55%' }}>
          {doc.author}
        </Text>
        <Text size="xs" c="dimmed">
          {dayjs(doc.updatedAt).format('D MMMM YYYY')}
        </Text>
      </Group>
    </Card>
  );
}
