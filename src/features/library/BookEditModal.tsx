import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';

import type { Book, BookMetaInput } from './types';

interface BookEditModalProps {
  book: Book | null;
  opened: boolean;
  onClose: () => void;
  onSave: (input: BookMetaInput) => void;
}

export function BookEditModal({ book, opened, onClose, onSave }: BookEditModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!book) return;
    setTitle(book.title);
    setAuthor(book.author);
    setDescription(book.description);
  }, [book]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), author: author.trim(), description: description.trim() });
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Информация о книге" centered>
      <Stack gap="sm">
        <TextInput label="Название" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
        <TextInput label="Автор" value={author} onChange={(e) => setAuthor(e.currentTarget.value)} />
        <Textarea
          label="Описание"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={4}
          autosize
          maxRows={10}
        />
        <Group justify="flex-end" mt="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSave}>Сохранить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
