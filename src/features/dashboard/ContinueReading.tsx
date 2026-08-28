import { Badge, Button, Group, Image, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBook2, IconBookmark } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { readRowLimit } from './rowLimit';
import { SortableRows } from './SortableRows';
import type { DashboardContext } from './dashboardContext';
import type { ReadingProgress } from './practice';
import linkClasses from './dashboardLinks.module.css';

export const CONTINUE_READING_ID = 'continue-reading';

/** Полка короткая: это карточка дашборда, а не раздел. Три строки под закреплённой — разумно. */
export const SHELF_DEFAULT = 3;

const FORMAT_LABEL: Record<string, string> = { pdf: 'PDF', docx: 'DOCX', fb2: 'FB2', djvu: 'DjVu' };

/**
 * Начатые книги: сверху та, которую читали последней, ниже — остальные.
 *
 * Раньше здесь была ровно одна книга, и это было верно, пока карточка отвечала на вопрос «что
 * продолжить». Теперь это короткая полка, но **верхняя строка закреплена и не перетаскивается**:
 * «продолжить чтение» обязано означать последнюю книгу, а не ту, которую однажды перетащили наверх.
 * Остальные расставляются вручную, и порядок лежит в раскладке дашборда — там же, где порядок
 * избранных калькуляторов.
 */
export function ContinueReading({
  shelf,
  settings,
}: {
  shelf: ReadingProgress[];
  settings: DashboardContext['widgetSettings'];
}) {
  if (shelf.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Ничего не начато. Откройте книгу в библиотеке — она появится здесь с того места, где вы остановились.
      </Text>
    );
  }

  const [latest, ...rest] = shelf;

  return (
    <Stack gap="md">
      <LatestBook reading={latest} />

      {rest.length > 0 && (
        <SortableRows
          items={rest.map((entry) => ({ ...entry, id: entry.book.id }))}
          order={settings.getOrder(CONTINUE_READING_ID)}
          onOrderChange={(ids) => settings.setOrder(CONTINUE_READING_ID, ids)}
          limit={readRowLimit(settings.get(CONTINUE_READING_ID), SHELF_DEFAULT)}
          moreLabel={(more) => `Раскрыть ещё ${more}`}
          renderRow={(entry) => <ShelfRow reading={entry} />}
        />
      )}
    </Stack>
  );
}

/** Последняя книга — с обложкой, прогрессом и кнопкой: ради неё карточку и открывают. */
function LatestBook({ reading }: { reading: ReadingProgress }) {
  const { book, percent, readAt } = reading;

  return (
    <Group align="flex-start" wrap="nowrap" gap="md">
      {book.coverDataUrl ? (
        <Image src={book.coverDataUrl} w={64} h={88} fit="cover" radius="sm" alt="" style={{ flexShrink: 0 }} />
      ) : (
        <ThemeIcon variant="light" color="brand" size={64} radius="sm" style={{ flexShrink: 0 }}>
          <IconBook2 size={28} />
        </ThemeIcon>
      )}

      <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
        <div>
          <Text fw={500} lineClamp={2}>
            {book.title}
          </Text>
          {book.author && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {book.author}
            </Text>
          )}
        </div>

        <Group gap={8} wrap="wrap">
          <Badge size="xs" variant="light" color="gray">
            {FORMAT_LABEL[book.format] ?? book.format.toUpperCase()}
          </Badge>
          <Text size="xs" c="dimmed">
            {dayjs(readAt).format('D MMMM')}
          </Text>
        </Group>

        {percent !== null && (
          <>
            <Progress value={percent} size="sm" radius="xl" aria-label={`Прочитано ${percent}%`} />
            <Text size="xs" c="dimmed">
              Прочитано {percent}%
              {book.pageCount ? ` · стр. ${book.progress?.location} из ${book.pageCount}` : ''}
            </Text>
          </>
        )}

        <Button
          component={Link}
          to={`/library/${book.id}/read`}
          state={{ from: '/dashboard' }}
          size="xs"
          variant="light"
          leftSection={<IconBookmark size={14} />}
          style={{ alignSelf: 'flex-start' }}
        >
          Продолжить чтение
        </Button>
      </Stack>
    </Group>
  );
}

/**
 * Остальные книги — строкой. Обложка в 64 px на каждую превратила бы карточку в раздел, а полка на
 * дашборде отвечает на вопрос «что ещё начато», а не «что есть в библиотеке».
 */
function ShelfRow({ reading }: { reading: ReadingProgress }) {
  const { book, percent } = reading;

  return (
    <Link
      to={`/library/${book.id}/read`}
      state={{ from: '/dashboard' }}
      className={linkClasses.row}
      style={{ flex: 1, minWidth: 0 }}
    >
      <Group gap={8} wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color="gray" size={28} radius="md">
          <IconBook2 size={14} />
        </ThemeIcon>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} truncate>
            {book.title}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {percent !== null ? `Прочитано ${percent}%` : (FORMAT_LABEL[book.format] ?? book.format.toUpperCase())}
          </Text>
        </div>
      </Group>
    </Link>
  );
}
