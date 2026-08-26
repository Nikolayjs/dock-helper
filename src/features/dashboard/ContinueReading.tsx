import { Badge, Button, Group, Image, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBook2, IconBookmark } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import type { ReadingProgress } from './practice';

const FORMAT_LABEL: Record<string, string> = { pdf: 'PDF', docx: 'DOCX', fb2: 'FB2', djvu: 'DjVu' };

/**
 * The book to pick back up. One book, not a shelf: a reading list belongs in the library, and what
 * is useful on a dashboard is the single click that resumes where the doctor stopped.
 */
export function ContinueReading({ reading }: { reading: ReadingProgress | null }) {
  if (!reading) {
    return (
      <Text size="sm" c="dimmed">
        Ничего не начато. Откройте книгу в библиотеке — она появится здесь с того места, где вы остановились.
      </Text>
    );
  }

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
