import { useMemo, useState } from 'react';
import { Button, Card, Group, Pagination, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowRight, IconChecklist, IconNote, IconNotes } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';

import { stripHtml } from '../notes/textPreview';
import { useNotes } from '../notes/useNotes';

/**
 * Заметки врача на странице профиля — витрина, а не рабочее место.
 *
 * Сюда заходят посмотреть, что записано, поэтому карточка показывает превью и уводит в раздел.
 * Постранично, а не списком целиком: заметок бывают сотни, а профиль — не место для реестра.
 *
 * Состояние (сортировка и текущая страница) живёт здесь: странице профиля оно не нужно ни разу.
 */
const PAGE_SIZE = 10;

function excerpt(note: { kind: string; content: string; items: { text: string }[] }) {
  if (note.kind === 'todo') {
    return note.items.map((item) => item.text).join(', ') || 'Пустой чек-лист';
  }
  return stripHtml(note.content) || 'Без текста';
}

export function DoctorNotesCard() {
  const navigate = useNavigate();
  const { notes } = useNotes();

  const sorted = useMemo(() => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [notes]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  // Удаление последней заметки на последней странице оставило бы врача на несуществующей.
  const activePage = Math.min(page, totalPages);
  const pageNotes = sorted.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  return (
    <Card withBorder padding="lg">
      <Group justify="space-between" mb="md">
        <Group gap={8}>
          <ThemeIcon variant="light" color="brand" size={30} radius="md">
            <IconNotes size={16} />
          </ThemeIcon>
          <Title order={5}>Заметки</Title>
        </Group>
        <Button component={Link} to="/notes" variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />}>
          Все заметки
        </Button>
      </Group>

      {sorted.length === 0 ? (
        <Text size="sm" c="dimmed">
          Заметок пока нет
        </Text>
      ) : (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {pageNotes.map((note) => (
              <Card
                key={note.id}
                withBorder
                padding="sm"
                style={{ cursor: 'pointer' }}
                // Происхождение едет в состоянии: кнопка «Назад» в заметке вернёт в профиль, а не
                // в список заметок, откуда врач сюда не приходил.
                onClick={() => navigate(`/notes/${note.id}`, { state: { from: '/doctor' } })}
              >
                <Group gap={8} wrap="nowrap" mb={6}>
                  <ThemeIcon variant="light" color={note.color} size={24} radius="sm">
                    {note.kind === 'todo' ? <IconChecklist size={13} /> : <IconNote size={13} />}
                  </ThemeIcon>
                  <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                    {note.title || 'Без названия'}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" lineClamp={2} mb={6}>
                  {excerpt(note)}
                </Text>
                <Text size="xs" c="dimmed">
                  {dayjs(note.createdAt).format('D MMMM YYYY')}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          {totalPages > 1 && (
            <Group justify="center">
              <Pagination total={totalPages} value={activePage} onChange={setPage} size="sm" />
            </Group>
          )}
        </Stack>
      )}
    </Card>
  );
}
