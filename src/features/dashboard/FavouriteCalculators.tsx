import { Group, Text, ThemeIcon } from '@mantine/core';
import { IconCalculator } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { useCalculators } from '../calculators/useCalculators';
import { readRowLimit, ROW_LIMIT_DEFAULT } from './rowLimit';
import { SortableRows } from './SortableRows';
import type { DashboardContext } from './dashboardContext';
import linkClasses from './dashboardLinks.module.css';

export const FAVOURITE_CALCULATORS_ID = 'favourite-calculators';

/**
 * Калькуляторы, отмеченные звёздочкой, — сразу на приёме, без захода в раздел.
 *
 * Как и лента новостей, тянет данные сам, а не через общий контекст дашборда: калькуляторы не нужны
 * ни одной другой карточке, и скрытая карточка не должна стоить запроса.
 *
 * Порядок строк врач задаёт перетаскиванием, сколько их видно сразу — настройкой карточки. И то и
 * другое лежит в раскладке дашборда: это расстановка, а не содержимое. Сама звёздочка остаётся в
 * базе — она про то, что калькулятор нужен, и терять её при переходе на другую машину было бы
 * обидно.
 */
export function FavouriteCalculators({ settings }: { settings: DashboardContext['widgetSettings'] }) {
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
    <SortableRows
      items={favourites}
      order={settings.getOrder(FAVOURITE_CALCULATORS_ID)}
      onOrderChange={(ids) => settings.setOrder(FAVOURITE_CALCULATORS_ID, ids)}
      limit={readRowLimit(settings.get(FAVOURITE_CALCULATORS_ID), ROW_LIMIT_DEFAULT)}
      moreLabel={(rest) => `Раскрыть ещё ${rest}`}
      renderRow={(calculator) => (
        <Link
          to={`/calculators/${calculator.id}`}
          state={{ from: '/dashboard' }}
          className={linkClasses.row}
          style={{ flex: 1, minWidth: 0 }}
          // Браузер тащит ссылку сам и, отпустив, переходит по ней мимо роутера.
          draggable={false}
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
      )}
    />
  );
}
