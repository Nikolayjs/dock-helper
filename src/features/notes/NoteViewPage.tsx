import { Badge, Button, Card, Checkbox, Container, Group, Progress, Stack, Text, Title, Typography } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useNotes } from './useNotes';

export function NoteViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const note = notes.find((n) => n.id === id);

  const from = (location.state as { from?: string } | null)?.from;
  const backTo = from === '/doctor' ? '/doctor' : from === '/calendar' ? '/calendar' : from === '/dashboard' ? '/dashboard' : '/notes';
  const backLabel =
    from === '/doctor' ? 'В профиль' : from === '/calendar' ? 'К календарю' : from === '/dashboard' ? 'К дашборду' : 'К списку заметок';

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

  const handleDelete = () => {
    deleteNote(note.id);
    notifications.show({ message: 'Заметка удалена', color: 'gray' });
    navigate(backTo);
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Button component={Link} to={backTo} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
            {backLabel}
          </Button>
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

        <div>
          <Title order={2}>{note.title}</Title>
          {note.pinnedDate && (
            <Badge variant="light" color={note.color} size="sm" mt={10}>
              {dayjs(note.pinnedDate).format('D MMMM YYYY')}
            </Badge>
          )}
          <Text size="xs" c="dimmed" mt={8}>
            Обновлено {dayjs(note.updatedAt).format('D MMMM YYYY')}
          </Text>
        </div>

        {note.kind === 'note' ? (
          <Typography>
            <div dangerouslySetInnerHTML={{ __html: note.content }} />
          </Typography>
        ) : (
          <Card withBorder padding="lg">
            <Stack gap="md">
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
          </Card>
        )}
      </Stack>
    </Container>
  );
}
