import { Badge, Button, Checkbox, Container, Group, Progress, Stack, Text, Title, Typography } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { QUERY_KEY as NOTES_KEY, useNotes } from './useNotes';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { BackButton } from '../../components/common/BackButton';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { labelForPath, readFrom } from '../../lib/backTarget';

export function NoteViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const confirmDelete = useDeleteWithConfirm();
  const note = notes.find((n) => n.id === id);

  // Раньше здесь была цепочка тернарников на три известных адреса: заметка, найденная поиском из
  // планера, всё равно уводила в список заметок. Теперь происхождение читает общий помощник.
  const from = readFrom(location.state);
  const { to: backTo, label: backLabel } = { to: from ?? '/notes', label: (from && labelForPath(from)) ?? 'К списку заметок' };

  if (!note) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Заметка не найдена</Text>
          <Button component={Link} to={backTo} mt="md">
            {backLabel}
          </Button>
        </Stack>
      </Container>
    );
  }

  const doneCount = note.items.filter((item) => item.done).length;

  const handleDelete = () =>
    confirmDelete({
      what: 'заметку',
      name: note.title,
      notice: 'Заметка удалена',
      queryKey: NOTES_KEY,
      id: note.id,
      perform: () => deleteNote(note.id),
      // Leaves the page as soon as it is confirmed; the undo window keeps running from the list.
      onConfirmed: () => navigate(backTo),
    });

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: '/notes', label: 'К списку заметок' }} />
          <Group gap="xs">
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
              Удалить
            </Button>
            <Button
              variant="light"
              leftSection={<IconEdit size={16} />}
              onClick={() => navigate(`/notes/${note.id}/edit`, { state: { from } })}
            >
              Редактировать
            </Button>
          </Group>
        </Group>

        {/* Заметка — такой же читаемый текст, как статья, и с обоями он лежал прямо на
            фотографии. Заголовок, дата и содержимое на одной подложке: снаружи остаются только
            действия над заметкой, они относятся к странице, а не к тексту. Чек-лист своей карточки
            больше не держит — она оказалась бы карточкой внутри карточки. */}
        <ReadingSheet>
          <Title order={2}>{note.title}</Title>
          {note.pinnedDate && (
            <Badge variant="light" color={note.color} size="sm" mt={10}>
              {dayjs(note.pinnedDate).format('D MMMM YYYY')}
            </Badge>
          )}
          <Text size="xs" c="dimmed" mt={8}>
            Обновлено {dayjs(note.updatedAt).format('D MMMM YYYY')}
          </Text>

          {note.kind === 'note' ? (
            <Typography mt="lg">
              <div dangerouslySetInnerHTML={{ __html: note.content }} />
            </Typography>
          ) : (
            <Stack gap="md" mt="lg">
              {note.items.length > 0 && (
                <Progress value={(doneCount / note.items.length) * 100} color={note.color} size={6} radius="xl" />
              )}
              <Stack gap="sm">
                {note.items.map((item) => (
                  <Checkbox
                    key={item.id}
                    label={item.text}
                    checked={item.done}
                    onChange={() => toggleTodoItem(note.id, item.id)}
                    styles={{ label: item.done ? { textDecoration: 'line-through', color: 'var(--mantine-color-dimmed)' } : undefined }}
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </ReadingSheet>
      </Stack>
    </Container>
  );
}
