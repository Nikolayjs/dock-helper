import { Badge, Card, Group, Text, ThemeIcon } from '@mantine/core';
import { IconCalculator } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import type { CalculatorDefinition } from './types';

const CATEGORY_COLORS: Record<string, string> = {
  Антропометрия: 'brand',
  Кардиология: 'red',
  Нефрология: 'grape',
  Педиатрия: 'orange',
  Пульмонология: 'cyan',
  Прочее: 'gray',
};

export function CalculatorCard({ definition }: { definition: CalculatorDefinition }) {
  const navigate = useNavigate();
  const color = CATEGORY_COLORS[definition.category] ?? 'brand';

  return (
    <Card
      withBorder
      padding="lg"
      style={{ cursor: 'pointer', height: '100%' }}
      onClick={() => navigate(`/calculators/${definition.id}`)}
    >
      <Group justify="space-between" align="flex-start" mb="sm">
        <ThemeIcon size={44} radius="md" variant="light" color={color}>
          <IconCalculator size={22} />
        </ThemeIcon>
        <Badge size="xs" variant="light" color={color}>
          {definition.category}
        </Badge>
      </Group>
      <Text fw={600} size="md" mb={4}>
        {definition.title}
      </Text>
      <Text size="sm" c="dimmed" lineClamp={2}>
        {definition.description || 'Без описания'}
      </Text>
    </Card>
  );
}
