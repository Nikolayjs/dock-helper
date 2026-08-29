import { Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconNotes } from '@tabler/icons-react';

import { useIncrementalList } from '../../lib/useIncrementalList';
import classes from '../drugs/DrugList.module.css';
import type { Icd10ListRow } from './types';

/**
 * Классификация на узком экране.
 *
 * Таблица из пяти колонок на телефоне требует бокового смахивания ради каждого поля, кроме кода.
 * Здесь вместо неё две строки на рубрику: код с наименованием и блок под ними — ровно то, ради чего
 * справочник открывают с телефона: найти код и открыть карточку.
 *
 * Стили общие со справочником препаратов: это один и тот же список, и расходиться им незачем.
 */
interface Props {
  rows: Icd10ListRow[];
  onOpen: (row: Icd10ListRow) => void;
}

export function Icd10List({ rows, onOpen }: Props) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows, 40);

  return (
    <Stack gap={0}>
      {visible.map((row) => (
        <div key={row.code} className={classes.row}>
          <UnstyledButton className={classes.main} onClick={() => onOpen(row)}>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text fw={600} size="sm" ff="monospace" style={{ flexShrink: 0 }}>
                {row.code}
              </Text>
              <Text size="sm" lineClamp={2} style={{ flex: 1 }}>
                {row.name}
              </Text>
              {row.hasNote && <IconNotes size={13} style={{ flexShrink: 0, opacity: 0.5 }} aria-label="Есть справка" />}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {row.blockRange} · {row.blockName}
              {row.children > 0 ? ` · подрубрик: ${row.children}` : ' · конечный код'}
            </Text>
          </UnstyledButton>
          <IconChevronRight size={16} className={classes.chevron} />
        </div>
      ))}
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
