import { ActionIcon, Badge, Card, Group, Stack, Text } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';

import type { Questionnaire } from './types';

interface QuestionnaireCardProps {
  questionnaire: Questionnaire;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function QuestionnaireCard({ questionnaire, onOpen, onEdit, onDelete }: QuestionnaireCardProps) {
  return (
    <Card withBorder padding="md" h="100%" style={{ cursor: 'pointer' }} onClick={onOpen}>
      <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
        <Text fw={600} size="sm" truncate style={{ flex: 1 }}>
          {questionnaire.title}
        </Text>
        <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Text size="sm" c="dimmed" lineClamp={2} mb="sm">
        {questionnaire.description || 'Без описания'}
      </Text>

      <Stack gap={0}>
        <Group gap={6}>
          <Badge variant="light" color="gray" size="sm">
            {questionnaire.diseases.length} {questionnaire.diseases.length === 1 ? 'заболевание' : 'заболеваний'}
          </Badge>
          <Badge variant="light" color="gray" size="sm">
            {questionnaire.symptoms.length} {questionnaire.symptoms.length === 1 ? 'симптом' : 'симптомов'}
          </Badge>
        </Group>
      </Stack>
    </Card>
  );
}
