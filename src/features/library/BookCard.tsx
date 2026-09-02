import { ActionIcon, Badge, Card, Group, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconBook2,
  IconCloud,
  IconDeviceFloppy,
  IconEdit,
  IconExternalLink,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconScan,
  IconTrash,
} from '@tabler/icons-react';

import type { Book } from './types';
import { LOCATION_LABEL, type BookLocation } from './useLocalFiles';

interface BookCardProps {
  book: Book;
  /** Где лежит файл. Спрашивается у хранилища браузера, а не у сервера, — см. `useLocalFiles`. */
  location: BookLocation;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Пометка спокойная, а не тревожная: книга, файл которой остался на рабочем компьютере, — это
 * нормальное положение вещей, а не поломка. Красным здесь была бы неправда.
 */
const LOCATION_ICON: Record<BookLocation, typeof IconBook2> = {
  here: IconDeviceFloppy,
  elsewhere: IconDeviceFloppy,
  cloud: IconCloud,
  link: IconExternalLink,
};

const FORMAT_LABEL: Record<Book['format'], string> = { pdf: 'PDF', docx: 'DOCX', fb2: 'FB2', djvu: 'DjVu' };
const FORMAT_ICON: Record<Book['format'], typeof IconBook2> = {
  pdf: IconFileTypePdf,
  docx: IconFileTypeDocx,
  fb2: IconBook2,
  djvu: IconScan,
};

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function progressPercent(book: Book): number | null {
  if (!book.progress) return null;
  // Reflowable formats have no pages, so their progress is already a fraction of the whole.
  if (book.format === 'fb2' || book.format === 'docx') return Math.round(book.progress.location * 100);
  return book.pageCount ? Math.round((book.progress.location / book.pageCount) * 100) : null;
}

export function BookCard({ book, location, onOpen, onEdit, onDelete }: BookCardProps) {
  const percent = progressPercent(book);
  const FormatIcon = FORMAT_ICON[book.format];
  const LocationIcon = LOCATION_ICON[location];

  return (
    <Card
      withBorder
      padding="md"
      h="100%"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
      onClick={onOpen}
    >
      <Card.Section>
        <div
          style={{
            position: 'relative',
            height: 200,
            background: 'var(--mantine-color-gray-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {book.coverDataUrl ? (
            <img src={book.coverDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ThemeIcon variant="light" color="brand" size={56} radius="md">
              <FormatIcon size={30} />
            </ThemeIcon>
          )}
          <Badge size="xs" variant="filled" color="dark" style={{ position: 'absolute', top: 8, right: 8 }}>
            {FORMAT_LABEL[book.format]}
          </Badge>
        </div>
      </Card.Section>

      <Stack gap={6} pt="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={2} style={{ flex: 1 }}>
            {book.title}
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

        {book.author && (
          <Text size="xs" c="dimmed" truncate>
            {book.author}
          </Text>
        )}

        {book.description && (
          <Text size="sm" c="dimmed" lineClamp={2}>
            {book.description}
          </Text>
        )}

        <div style={{ flex: 1 }} />

        {percent !== null && <Progress value={percent} size={4} radius="xl" color="brand" />}

        <Group gap={4} wrap="nowrap">
          <LocationIcon size={13} style={{ color: 'var(--mantine-color-dimmed)', flexShrink: 0 }} />
          <Text size="xs" c="dimmed" truncate>
            {LOCATION_LABEL[location]}
          </Text>
        </Group>

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {book.storage === 'link' ? 'Ссылка' : formatSize(book.fileSize)}
          </Text>
          {percent !== null && (
            <Text size="xs" c="dimmed">
              {percent}%
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}
