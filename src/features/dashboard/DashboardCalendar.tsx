import { useMemo, useState } from 'react';
import { Badge, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBellRinging, IconNote } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { MarkedCalendar } from '../../components/common/MarkedCalendar';
import type { Note } from '../notes/types';
import type { Reminder } from '../reminders/types';

/**
 * The month, and what is on the day you pick.
 *
 * Deliberately *not* the calendar page moved here. That page is a working tool — two tabs, adding,
 * editing, deleting — and copying it onto the dashboard would leave the application with two places
 * that do the same thing and one of them always slightly behind. This card answers the question a
 * dashboard is for ("what is on this day?") and hands over to the page for the rest.
 *
 * Notes and reminders share one calendar here rather than sitting in tabs: on a dashboard the
 * question is what the day holds, not which of the two kinds it holds. They are told apart in the
 * list below by icon and label, never by the dot alone.
 */
interface DashboardCalendarProps {
  notes: Note[];
  reminders: Reminder[];
}

type DayEntry =
  | { kind: 'note'; id: string; title: string; note: Note }
  | { kind: 'reminder'; id: string; title: string; time: string };

export function DashboardCalendar({ notes, reminders }: DashboardCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (date: string, entry: DayEntry) => {
      const list = map.get(date);
      if (list) list.push(entry);
      else map.set(date, [entry]);
    };

    for (const note of notes) {
      if (note.pinnedDate) push(note.pinnedDate, { kind: 'note', id: note.id, title: note.title, note });
    }
    for (const reminder of reminders) {
      const at = dayjs(reminder.datetime);
      if (at.isValid()) {
        push(at.format('YYYY-MM-DD'), {
          kind: 'reminder',
          id: reminder.id,
          title: reminder.title,
          time: at.format('HH:mm'),
        });
      }
    }
    return map;
  }, [notes, reminders]);

  const selected = entriesByDate.get(selectedDate) ?? [];
  const isToday = selectedDate === dayjs().format('YYYY-MM-DD');

  return (
    <Stack gap="md">
      <MarkedCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        entriesByDate={entriesByDate}
        dotColor="brand"
      />

      <div>
        <Group justify="space-between" mb="xs" wrap="nowrap">
          <Text size="sm" fw={600}>
            {isToday ? 'Сегодня' : dayjs(selectedDate).format('D MMMM')}
          </Text>
          {selected.length > 0 && (
            <Badge size="sm" variant="light" color="brand">
              {selected.length}
            </Badge>
          )}
        </Group>

        {selected.length === 0 ? (
          <Text size="sm" c="dimmed">
            На этот день ничего не запланировано.
          </Text>
        ) : (
          <Stack gap="xs">
            {selected.map((entry) =>
              entry.kind === 'note' ? (
                <Link
                  key={entry.id}
                  to={`/notes/${entry.id}`}
                  state={{ from: '/dashboard' }}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <Group gap={8} wrap="nowrap" align="flex-start">
                    <ThemeIcon variant="light" color="brand" size={24} radius="md">
                      <IconNote size={13} />
                    </ThemeIcon>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" truncate>
                        {entry.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Заметка
                      </Text>
                    </div>
                  </Group>
                </Link>
              ) : (
                <Group key={entry.id} gap={8} wrap="nowrap" align="flex-start">
                  <ThemeIcon variant="light" color="orange" size={24} radius="md">
                    <IconBellRinging size={13} />
                  </ThemeIcon>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" truncate>
                      {entry.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Напоминание · {entry.time}
                    </Text>
                  </div>
                </Group>
              ),
            )}
          </Stack>
        )}
      </div>
    </Stack>
  );
}
