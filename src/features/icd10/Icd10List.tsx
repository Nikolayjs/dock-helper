import { ActionIcon, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconNotes } from '@tabler/icons-react';

import { useIncrementalList } from '../../lib/useIncrementalList';
import classes from '../drugs/DrugList.module.css';
import type { Icd10Row } from './types';

/**
 * Классификация на узком экране.
 *
 * Таблица из пяти колонок на телефоне требует бокового смахивания ради каждого поля, кроме кода.
 * Здесь вместо неё две строки на рубрику: код с наименованием и блок под ними — ровно то, ради чего
 * справочник открывают с телефона: найти код и открыть карточку.
 *
 * **Нажатие на рубрику её раскрывает**, а карточку открывает стрелка справа. Пальцем берут строку,
 * а не значок, и список, внутри которого ещё есть данные, обязан раскрываться нажатием на себя.
 * Конечный код раскрывать нечем — нажатие на него сразу открывает карточку.
 *
 * Стили общие со справочником препаратов: это один и тот же список, и расходиться им незачем.
 */
interface Props {
  rows: Icd10Row[];
  onOpen: (row: Icd10Row) => void;
  onToggle: (code: string) => void;
  /** Нажатие на строку: рубрику с уточнениями раскрывает, всё прочее открывает. */
  onRowClick: (row: Icd10Row) => void;
}

export function Icd10List({ rows, onOpen, onToggle, onRowClick }: Props) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows, 40);

  return (
    <Stack gap={0}>
      {visible.map((row) => (
        <div key={row.code} className={classes.row}>
          {/* Место под стрелку занято всегда: иначе строки рубрик и конечных кодов начинались бы
              на разной высоте отступа, и список читался бы как рваный. */}
          <div style={{ width: 34, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
            {row.depth === 0 && row.children > 0 && (
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => onToggle(row.code)}
                aria-label={row.expanded ? `Свернуть подрубрики ${row.code}` : `Раскрыть подрубрики ${row.code}`}
                aria-expanded={row.expanded}
              >
                <IconChevronRight
                  size={16}
                  style={{ transform: row.expanded ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }}
                />
              </ActionIcon>
            )}
          </div>
          <UnstyledButton className={classes.main} onClick={() => onRowClick(row)} pl={row.depth === 0 ? 0 : 16}>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text
                fw={row.depth === 0 ? 600 : 400}
                size="sm"
                ff="monospace"
                c={row.depth === 0 ? undefined : 'dimmed'}
                style={{ flexShrink: 0 }}
              >
                {row.code}
              </Text>
              <Text size="sm" lineClamp={2} style={{ flex: 1 }} c={row.depth === 0 ? undefined : 'dimmed'}>
                {row.name}
              </Text>
              {row.hasNote && <IconNotes size={13} style={{ flexShrink: 0, opacity: 0.5 }} aria-label="Есть справка" />}
            </Group>
            {/* У подрубрики блок тот же, что у рубрики строкой выше: повторять его — занимать
                вторую строку тем, что уже прочитано. */}
            {row.depth === 0 ? (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {row.blockRange} · {row.blockName}
                {row.children > 0 ? ` · подрубрик: ${row.children}` : ' · конечный код'}
              </Text>
            ) : null}
          </UnstyledButton>
          {/* Стрелка справа открывает карточку. У рубрики с уточнениями это единственный путь к
              ней: нажатие на саму строку занято раскрытием — поэтому цель здесь на ступень крупнее,
              чем в таблице: по ней попадают пальцем. */}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            className={classes.chevron}
            onClick={() => onOpen(row)}
            aria-label={`Открыть карточку ${row.code}`}
          >
            <IconChevronRight size={16} />
          </ActionIcon>
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
