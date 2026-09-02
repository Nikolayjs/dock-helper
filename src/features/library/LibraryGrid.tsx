import { useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { isDemoSession } from '../demo/demoSession';
import { IconBooks, IconCloudUpload, IconLink, IconPlus, IconSearch } from '@tabler/icons-react';

import { BookCard } from './BookCard';
import type { Book } from './types';
import { bookLocation, useLocalFiles, useStorageUsage } from './useLocalFiles';

interface LibraryGridProps {
  books: Book[];
  isAdding?: boolean;
  isAddingLink?: boolean;
  onAddFiles: (files: File[], options: { cloud: boolean }) => void;
  onAddLink: (record: { title: string; author: string; description: string; sourceUrl: string }) => Promise<unknown>;
  onOpen: (book: Book) => void;
  onEdit: (book: Book) => void;
  onDelete: (book: Book) => void;
  /** Полоса переноса облачных книг на устройство: её состояние держит страница, место ей здесь. */
  migration?: ReactNode;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

export function LibraryGrid({
  books,
  isAdding,
  isAddingLink,
  onAddFiles,
  onAddLink,
  onOpen,
  onEdit,
  onDelete,
  migration,
}: LibraryGridProps) {
  const [search, setSearch] = useState('');
  /**
   * Облачная полка — выбор, а не режим по умолчанию.
   *
   * Выключенный переключатель означает «книга остаётся на этом устройстве»: ноль трафика при
   * добавлении и ноль при каждом открытии. Включённый — прежний путь с загрузкой на сервер, и
   * именно он стоит денег, поэтому здесь и пройдёт платная граница.
   */
  const [cloud, setCloud] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState({ title: '', author: '', description: '', sourceUrl: '' });

  const { present } = useLocalFiles(books);
  // Пересчитывается при смене состава полки: добавили книгу — занятое место изменилось.
  const storage = useStorageUsage(books.length);

  const filtered = books.filter((book) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return book.title.toLowerCase().includes(query) || book.author.toLowerCase().includes(query);
  });

  const sorted = [...filtered].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const demo = isDemoSession();
  const free = storage ? storage.quota - storage.used : null;
  // «Мало места» — это когда не влезет ещё одна книга обычного размера, а не «меньше процента».
  const lowOnSpace = free !== null && storage !== null && storage.quota > 0 && free < 300 * 1024 * 1024;

  const submitLink = async () => {
    await onAddLink({ ...link, sourceUrl: link.sourceUrl.trim() });
    setLink({ title: '', author: '', description: '', sourceUrl: '' });
    setLinkOpen(false);
  };

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
        <Group gap="sm" wrap="wrap">
          {!demo && (
            <Tooltip
              label="Книга уедет на сервер и будет доступна с любого устройства. Без этого она остаётся здесь и не тратит трафик при открытии."
              withArrow
              multiline
              w={280}
            >
              <Switch
                size="sm"
                checked={cloud}
                onChange={(e) => setCloud(e.currentTarget.checked)}
                label="Хранить в облаке"
                thumbIcon={cloud ? <IconCloudUpload size={10} /> : undefined}
              />
            </Tooltip>
          )}
          {/* В демо книгу некуда положить: сервера нет, а хранилище браузера гостевая сессия
              обещает не трогать. Кнопка остаётся на месте и объясняет почему — исчезнувшая
              кнопка выглядит как отсутствующая возможность. */}
          {demo ? (
            <Tooltip label="В демо-режиме недоступно: книга сохраняется на устройстве или на сервере" withArrow>
              <Button leftSection={<IconPlus size={18} />} disabled data-disabled>
                Добавить книгу
              </Button>
            </Tooltip>
          ) : (
            <>
              <Button variant="light" leftSection={<IconLink size={18} />} onClick={() => setLinkOpen(true)}>
                По ссылке
              </Button>
              <FileButton
                onChange={(files) => onAddFiles(files, { cloud })}
                accept=".pdf,.docx,.fb2,.djvu,.djv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
              >
                {(props) => (
                  <Button {...props} leftSection={<IconPlus size={18} />} loading={isAdding}>
                    Добавить книгу
                  </Button>
                )}
              </FileButton>
            </>
          )}
        </Group>
      </Group>

      {migration}

      {storage !== null && storage.quota > 0 && (
        <Text size="xs" c="dimmed">
          Книги на этом устройстве занимают {formatBytes(storage.used)} из {formatBytes(storage.quota)}, доступных
          браузеру.
        </Text>
      )}

      {lowOnSpace && (
        <Alert color="yellow" variant="light" title="Свободного места мало">
          Осталось около {formatBytes(free ?? 0)}. Когда места не хватает, браузер вправе вычистить хранилище — книгу
          придётся добавить заново с файла. Удалите ненужные или храните большие в облаке.
        </Alert>
      )}

      {sorted.length === 0 ? (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconBooks size={24} />
            </ThemeIcon>
            <Text fw={600}>Пока нет книг</Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Загрузите файлы в формате PDF, DOCX, FB2 или DjVu — обложка и описание определятся автоматически. Файл
              остаётся на этом устройстве, на сервер уходит только полка.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
          {sorted.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              location={bookLocation(book, present)}
              onOpen={() => onOpen(book)}
              onEdit={() => onEdit(book)}
              onDelete={() => onDelete(book)}
            />
          ))}
        </SimpleGrid>
      )}

      <Modal opened={linkOpen} onClose={() => setLinkOpen(false)} title="Книга по ссылке" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Ни файла, ни трафика: сохраняется только адрес первоисточника и дата последнего открытия. Годится для
            рубрикатора клинических рекомендаций Минздрава, КиберЛенинки, PubMed Central и вузовских ЭБС.
          </Text>
          <TextInput
            label="Адрес"
            placeholder="https://cr.minzdrav.gov.ru/…"
            value={link.sourceUrl}
            onChange={(e) => setLink({ ...link, sourceUrl: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Название"
            value={link.title}
            onChange={(e) => setLink({ ...link, title: e.currentTarget.value })}
            required
          />
          <TextInput label="Автор" value={link.author} onChange={(e) => setLink({ ...link, author: e.currentTarget.value })} />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={() => setLinkOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={submitLink}
              loading={isAddingLink}
              disabled={!link.title.trim() || !/^https?:\/\//i.test(link.sourceUrl.trim())}
            >
              Добавить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
