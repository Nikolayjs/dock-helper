import { ActionIcon, Divider, Indicator, Menu, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBell, IconChecklist, IconNote } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { getTodayChecklist, getTodayNotes } from '../../features/dashboard/selectors';
import { useNotes } from '../../features/notes/useNotes';

export function HeaderNotifications() {
  const navigate = useNavigate();
  const { notes } = useNotes();

  const checklist = getTodayChecklist(notes).filter((item) => !item.done);
  const todayNotes = getTodayNotes(notes).filter((note) => note.kind !== 'todo');
  const total = checklist.length + todayNotes.length;

  return (
    <Menu position="bottom-end" width={320} shadow="md" withinPortal>
      <Menu.Target>
        <Indicator color="red" size={8} offset={4} disabled={total === 0}>
          <ActionIcon variant="light" color="gray" size="lg" radius="md">
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Уведомления на сегодня</Menu.Label>

        {total === 0 ? (
          <Text size="sm" c="dimmed" px="sm" py="md">
            На сегодня ничего не запланировано
          </Text>
        ) : (
          <Stack gap={0}>
            {checklist.map((item) => (
              <Menu.Item
                key={item.id}
                leftSection={
                  <ThemeIcon variant="light" color="brand" size={26} radius="sm">
                    <IconChecklist size={14} />
                  </ThemeIcon>
                }
                onClick={() => navigate(`/notes/${item.noteId}`)}
              >
                <Text size="sm" fw={500} truncate>
                  {item.text}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {item.noteTitle}
                </Text>
              </Menu.Item>
            ))}

            {checklist.length > 0 && todayNotes.length > 0 && <Divider my={4} />}

            {todayNotes.map((note) => (
              <Menu.Item
                key={note.id}
                leftSection={
                  <ThemeIcon variant="light" color={note.color} size={26} radius="sm">
                    <IconNote size={14} />
                  </ThemeIcon>
                }
                onClick={() => navigate(`/notes/${note.id}`)}
              >
                <Text size="sm" fw={500} truncate>
                  {note.title || 'Без названия'}
                </Text>
              </Menu.Item>
            ))}
          </Stack>
        )}

        <Divider my={4} />
        <Menu.Item onClick={() => navigate('/calendar')}>
          <Text size="sm" c="dimmed" ta="center">
            Открыть календарь
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
