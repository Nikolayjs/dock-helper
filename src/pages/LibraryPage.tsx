import { useState } from 'react';
import { Container } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { BookEditModal } from '../features/library/BookEditModal';
import { LibraryGrid } from '../features/library/LibraryGrid';
import type { Book } from '../features/library/types';
import { useLibrary } from '../features/library/useLibrary';

export function LibraryPage() {
  const { books, addBook, isAdding, updateMeta, deleteBook } = useLibrary();
  const navigate = useNavigate();
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const handleAddFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        await addBook(file);
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : 'Не удалось добавить книгу',
          color: 'red',
        });
      }
    }
  };

  const handleDelete = (book: Book) => {
    deleteBook(book.id);
    notifications.show({ message: 'Книга удалена', color: 'gray' });
  };

  return (
    <Container size="xl" px={0}>
      <LibraryGrid
        books={books}
        isAdding={isAdding}
        onAddFiles={handleAddFiles}
        onOpen={(book) => navigate(`/library/${book.id}`)}
        onEdit={setEditingBook}
        onDelete={handleDelete}
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
