import { useMemo, useState } from 'react';
import { ActionIcon, Divider, Indicator, Menu, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBell, IconChecklist, IconNote } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { getTodayChecklist, getTodayNotes } from '../../features/dashboard/selectors';
import { useNotes } from '../../features/notes/useNotes';
import { countUnseen, markSeen, readSeen } from './seenNotifications';

export function HeaderNotifications() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [seen, setSeen] = useState<string[]>(() => readSeen());

  const checklist = getTodayChecklist(notes).filter((item) => !item.done);
  const todayNotes = getTodayNotes(notes).filter((note) => note.kind !== 'todo');
  const total = checklist.length + todayNotes.length;

  /*
   * Ключи пунктов чек-листа и заметок в одном списке, поэтому у каждого свой вид: `id` заметки и
   * `id` пункта приходят из разных таблиц и однажды совпадут.
   */
  const ids = useMemo(
    () => [...checklist.map((item) => 'todo:' + item.id), ...todayNotes.map((note) => 'note:' + note.id)],
    [checklist, todayNotes],
  );
  const unseen = countUnseen(ids, seen);

  /*
   * Отмечается просмотренным **открытие** списка, а не наведение на колокольчик: бейдж обязан
   * гаснуть тогда, когда врач действительно увидел, что там лежит.
   */
  const handleOpen = () => {
    markSeen(ids);
    setSeen(ids);
  };

  return (
    <Menu position="bottom-end" width={320} shadow="md" withinPortal onOpen={handleOpen}>
      <Menu.Target>
        <Indicator color="red" size={8} offset={4} disabled={unseen === 0}>
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
