import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCalculator } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useCalculators } from '../calculators/useCalculators';
import linkClasses from './dashboardLinks.module.css';

/**
 * Калькуляторы, отмеченные звёздочкой, — сразу на приёме, без захода в раздел.
 *
 * Как и лента новостей, тянет данные сам, а не через общий контекст дашборда: калькуляторы не нужны
 * ни одной другой карточке, и скрытая карточка не должна стоить запроса.
 */
export function FavouriteCalculators() {
  const { calculators } = useCalculators();
  const favourites = calculators.filter((calculator) => calculator.favourite);

  if (favourites.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Пока ничего не отмечено. Нажмите звёздочку на карточке калькулятора — он появится здесь и будет
        открываться в один клик.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {favourites.map((calculator) => (
        <Link
          key={calculator.id}
          to={`/calculators/${calculator.id}`}
          state={{ from: '/dashboard' }}
          className={linkClasses.row}
        >
          <Group gap={8} wrap="nowrap" align="flex-start">
            <ThemeIcon variant="light" color="brand" size={28} radius="md">
              <IconCalculator size={14} />
            </ThemeIcon>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text size="sm" fw={500} truncate>
                {calculator.title}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {calculator.category}
              </Text>
            </div>
          </Group>
        </Link>
      ))}
    </Stack>
  );
}
