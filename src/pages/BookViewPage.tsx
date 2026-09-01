import { useState } from 'react';

import { PageToolbar } from '../components/common/PageToolbar';
import { Badge, Button, Container, Group, Image, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBook2, IconBookmark, IconEdit, IconFileTypeDocx, IconFileTypePdf, IconScan, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BookEditModal } from '../features/library/BookEditModal';
import type { Book } from '../features/library/types';
import { QUERY_KEY as LIBRARY_KEY, useBook } from '../features/library/useLibrary';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { BackButton } from '../components/common/BackButton';
import { ReadingSheet } from '../components/common/ReadingSheet';

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

export function BookViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { book, updateMeta, deleteBook } = useBook(id);
  const confirmDelete = useDeleteWithConfirm();
  const [editing, setEditing] = useState(false);
  const FormatIcon = book ? FORMAT_ICON[book.format] : IconBook2;

  if (!book) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Книга не найдена</Text>
          <Button component={Link} to="/library" mt="md">
            К библиотеке
          </Button>
        </Stack>
      </Container>
    );
  }

  const handleDelete = () =>
    confirmDelete({
      what: 'книгу',
      name: book.title,
      notice: 'Книга удалена',
      queryKey: LIBRARY_KEY,
      id: book.id,
      perform: () => deleteBook(book.id),
      onConfirmed: () => navigate('/library'),
    });

  const progressLabel = book.progress
    ? book.pageCount
      ? `Стр. ${book.progress.location} из ${book.pageCount}`
      : `Прочитано ${Math.round(book.progress.location * 100)}%`
    : null;

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <PageToolbar>
          <Group justify="space-between" wrap="wrap">
            <BackButton fallback={{ to: '/library', label: 'К библиотеке' }} />
            <Group gap="xs">
              <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                Удалить
              </Button>
              <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => setEditing(true)}>
                Редактировать
              </Button>
            </Group>
          </Group>
        </PageToolbar>

        {/* Обложка, название и автор — то, ради чего страницу открывают, и на обоях они лежали
            прямо на фотографии. Подложка та же, что под читаемым текстом: на телефоне она занимает
            всю ширину экрана, иначе от неё осталась бы колонка в три четверти. */}
        <ReadingSheet>
          <Group align="flex-start" gap="xl" wrap="wrap">
          <div style={{ width: 220, flexShrink: 0 }}>
            {book.coverDataUrl ? (
              <Image src={book.coverDataUrl} radius="md" style={{ boxShadow: 'var(--mantine-shadow-md)' }} />
            ) : (
              <div
                style={{
                  width: '100%',
                  aspectRatio: '3 / 4',
                  borderRadius: 'var(--mantine-radius-md)',
                  background: 'var(--mantine-color-gray-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ThemeIcon variant="light" color="brand" size={64} radius="md">
                  <FormatIcon size={34} />
                </ThemeIcon>
              </div>
            )}
          </div>

          <Stack gap="sm" style={{ flex: 1, minWidth: 260 }}>
            <Group gap="xs">
              <Badge variant="light" color="gray">
                {FORMAT_LABEL[book.format]}
              </Badge>
              <Text size="xs" c="dimmed">
                {formatSize(book.fileSize)}
              </Text>
            </Group>
            <Title order={2}>{book.title}</Title>
            {book.author && <Text c="dimmed">{book.author}</Text>}
            {book.description && (
              <Text size="sm" style={{ whiteSpace: 'pre-line' }} mt="xs">
                {book.description}
              </Text>
            )}
            <Text size="xs" c="dimmed" mt="xs">
              Добавлено {dayjs(book.addedAt).format('D MMMM YYYY')}
            </Text>

            <Group mt="md">
              <Button size="md" leftSection={<IconBookmark size={18} />} onClick={() => navigate(`/library/${book.id}/read`)}>
                {book.progress ? 'Продолжить чтение' : 'Читать'}
              </Button>
              {progressLabel && (
                <Text size="sm" c="dimmed">
                  {progressLabel}
                </Text>
              )}
            </Group>
          </Stack>
          </Group>
        </ReadingSheet>
      </Stack>

      <BookEditModal book={book} opened={editing} onClose={() => setEditing(false)} onSave={(input) => updateMeta(book.id, input)} />
    </Container>
  );
}
