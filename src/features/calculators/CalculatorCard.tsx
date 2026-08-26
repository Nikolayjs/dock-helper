import { ActionIcon, Badge, Card, Group, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconCalculator, IconStar, IconStarFilled } from '@tabler/icons-react';
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

interface CalculatorCardProps {
  definition: CalculatorDefinition;
  /** Отсутствует там, где отмечать нечем — например, в подборке на дашборде. */
  onToggleFavourite?: () => void;
}

export function CalculatorCard({ definition, onToggleFavourite }: CalculatorCardProps) {
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
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" variant="light" color={color}>
            {definition.category}
          </Badge>
          {onToggleFavourite && (
            <Tooltip label={definition.favourite ? 'Убрать из избранного' : 'В избранное'} withArrow>
              <ActionIcon
                variant="subtle"
                color={definition.favourite ? 'yellow' : 'gray'}
                size="sm"
                aria-label={definition.favourite ? 'Убрать из избранного' : 'В избранное'}
                onClick={(event) => {
                  // Карточка целиком — ссылка на калькулятор; звёздочка не должна его открывать.
                  event.stopPropagation();
                  onToggleFavourite();
                }}
              >
                {definition.favourite ? <IconStarFilled size={15} /> : <IconStar size={15} />}
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
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
