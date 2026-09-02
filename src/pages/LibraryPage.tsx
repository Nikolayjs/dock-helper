import { useRef, useState } from 'react';
import { Alert, Button, Container, Group, Progress, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { BookEditModal } from '../features/library/BookEditModal';
import { LibraryGrid } from '../features/library/LibraryGrid';
import type { Book } from '../features/library/types';
import { QUERY_KEY as LIBRARY_KEY, useLibrary } from '../features/library/useLibrary';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function LibraryPage() {
  const { books, addBook, isAdding, addLinkBook, isAddingLink, moveToDevice, updateMeta, deleteBook } = useLibrary();
  const navigate = useNavigate();
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const confirmDelete = useDeleteWithConfirm();

  /**
   * Массовый перенос облачных книг на устройство.
   *
   * По одной книге за раз и с возможностью прервать: это чужой трафик, и качать десять учебников
   * разом на мобильном интернете — не то, о чём читателя спрашивали. Ошибка на одной книге очередь
   * не роняет: её пропускают и говорят об этом в конце.
   */
  const cloudBooks = books.filter((book) => book.storage === 'server');
  const [migration, setMigration] = useState<{ done: number; total: number; failed: number } | null>(null);
  const abortRef = useRef(false);

  const migrateAll = async () => {
    abortRef.current = false;
    const queue = books.filter((book) => book.storage === 'server');
    setMigration({ done: 0, total: queue.length, failed: 0 });
    let failed = 0;
    for (const [index, book] of queue.entries()) {
      if (abortRef.current) break;
      try {
        await moveToDevice(book);
      } catch {
        failed += 1;
      }
      setMigration({ done: index + 1, total: queue.length, failed });
    }
    const stopped = abortRef.current;
    setMigration(null);
    notifications.show({
      message: stopped
        ? 'Перенос остановлен. Уже перенесённые книги остались на устройстве.'
        : failed
          ? `Перенесено книг: ${queue.length - failed}. Не удалось: ${failed}.`
          : `Перенесено на устройство книг: ${queue.length}.`,
      color: failed ? 'yellow' : 'green',
    });
  };

  const handleAddFiles = async (files: File[], options: { cloud: boolean }) => {
    for (const file of files) {
      try {
        const { book, duplicate } = await addBook({ file, cloud: options.cloud });
        if (duplicate) {
          notifications.show({ message: `Такая книга уже есть на полке: «${book.title}»`, color: 'blue' });
          navigate(`/library/${book.id}`);
        }
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : 'Не удалось добавить книгу',
          color: 'red',
        });
      }
    }
  };

  const handleDelete = (book: Book) =>
    confirmDelete({
      what: 'книгу',
      name: book.title,
      notice: 'Книга удалена',
      queryKey: LIBRARY_KEY,
      id: book.id,
      perform: () => deleteBook(book),
    });

  return (
    <Container size="xl" px={0}>
      <LibraryGrid
        books={books}
        isAdding={isAdding}
        isAddingLink={isAddingLink}
        onAddFiles={handleAddFiles}
        onAddLink={addLinkBook}
        onOpen={(book) => navigate(`/library/${book.id}`)}
        onEdit={setEditingBook}
        onDelete={handleDelete}
        migration={
          migration ? (
            <Alert color="blue" variant="light" title="Переношу книги на это устройство">
              <Progress value={(migration.done / Math.max(1, migration.total)) * 100} size="sm" mb="xs" />
              <Group justify="space-between">
                <Text size="sm">
                  {migration.done} из {migration.total}
                  {migration.failed > 0 ? `, не удалось: ${migration.failed}` : ''}
                </Text>
                <Button size="xs" variant="subtle" onClick={() => (abortRef.current = true)}>
                  Остановить
                </Button>
              </Group>
            </Alert>
          ) : cloudBooks.length > 0 ? (
            <Alert color="gray" variant="light" title="Книги в облаке">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Text size="sm" style={{ flex: 1, minWidth: 240 }}>
                  {cloudBooks.length === 1 ? 'Одна книга хранится' : `Книг в облаке: ${cloudBooks.length}`} — они
                  скачиваются при каждом открытии. Перенос на устройство качает файл один раз и делает открытие
                  мгновенным.
                </Text>
                <Button size="xs" variant="light" leftSection={<IconDeviceFloppy size={14} />} onClick={migrateAll}>
                  Перенести на устройство
                </Button>
              </Group>
            </Alert>
          ) : null
        }
      />
      <BookEditModal
        book={editingBook}
        opened={editingBook !== null}
        onClose={() => setEditingBook(null)}
        onSave={(input) => editingBook && updateMeta(editingBook.id, input)}
      />
    </Container>
  );
}
