import { useState } from 'react';
import { Button, Card, FileButton, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconBooks, IconPlus, IconSearch } from '@tabler/icons-react';

import { BookCard } from './BookCard';
import type { Book } from './types';

interface LibraryGridProps {
  books: Book[];
  isAdding?: boolean;
  onAddFiles: (files: File[]) => void;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
}

export function LibraryGrid({ books, isAdding, onAddFiles, onOpen, onEdit, onDelete }: LibraryGridProps) {
  const [search, setSearch] = useState('');

  const filtered = books.filter((book) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
  });

  const sorted = [...filtered].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap" gap="md">
        <TextInput
          placeholder="Поиск по названию или автору…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={280}
        />
        <FileButton onChange={onAddFiles} accept=".pdf,.fb2,.djvu,.djv,application/pdf" multiple>
          {(props) => (
            <Button {...props} leftSection={<IconPlus size={18} />} loading={isAdding}>
              Добавить книгу
            </Button>
          )}
        </FileButton>
      </Group>

      {sorted.length === 0 ? (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconBooks size={24} />
            </ThemeIcon>
            <Text fw={600}>Пока нет книг</Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Загрузите файлы в формате PDF, FB2 или DjVu — обложка и описание определятся автоматически.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {sorted.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onOpen={() => onOpen(book)}
              onEdit={() => onEdit(book)}
              onDelete={() => onDelete(book)}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
