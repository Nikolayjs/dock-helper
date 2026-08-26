import { ActionIcon, Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconChevronRight, IconEdit } from '@tabler/icons-react';

import { useIncrementalList } from '../../lib/useIncrementalList';
import classes from './DrugList.module.css';
import type { DrugSummary } from './types';

interface Props {
  drugs: DrugSummary[];
  /** Нормализованное МНН → сколько правил его упоминают. */
  interactionCounts: Map<string, number>;
  normalizeInn: (inn: string) => string;
  onOpen: (drug: DrugSummary) => void;
  onEdit: (drug: DrugSummary) => void;
}

/**
 * Справочник на узком экране.
 *
 * Таблица из семи колонок на телефоне разворачивается в 1217 пикселей и требует бокового смахивания
 * ради каждого поля, кроме первого. Здесь вместо неё две строки на препарат: МНН со счётчиком
 * взаимодействий и торговые названия под ним — ровно то, ради чего справочник открывают с телефона,
 * то есть найти препарат и открыть карточку.
 *
 * Раздел и фармгруппа не показываются намеренно: раздел уже выбран фильтром выше, а фармгруппа
 * читается на самой карточке. Сортировка на телефоне тоже не выносится — заголовков колонок нет,
 * а список идёт по МНН, как в книге.
 */
export function DrugList({ drugs, interactionCounts, normalizeInn, onOpen, onEdit }: Props) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(drugs, 40);

  return (
    <Stack gap={0}>
      {visible.map((drug) => {
        const count = interactionCounts.get(normalizeInn(drug.inn)) ?? 0;
        return (
          <div key={drug.id} className={classes.row}>
            <UnstyledButton className={classes.main} onClick={() => onOpen(drug)}>
              <Group gap="xs" wrap="nowrap" align="center">
                <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
                  {drug.inn}
                </Text>
                {count > 0 && (
                  <Badge size="sm" variant="light" color="orange" tt="none" leftSection={<IconAlertTriangle size={11} />}>
                    {count}
                  </Badge>
                )}
              </Group>
              {drug.brandNames.length > 0 && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {drug.brandNames.join(', ')}
                </Text>
              )}
            </UnstyledButton>
            <Group gap={2} wrap="nowrap">
              <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(drug)} aria-label={`Изменить ${drug.inn}`}>
                <IconEdit size={16} />
              </ActionIcon>
              <IconChevronRight size={16} className={classes.chevron} />
            </Group>
          </div>
        );
      })}

      {hasMore && (
        <div ref={setSentinel} className={classes.sentinel}>
          <Text size="xs" c="dimmed">
            Загружается ещё… осталось {remaining}
          </Text>
        </div>
      )}
    </Stack>
  );
}
