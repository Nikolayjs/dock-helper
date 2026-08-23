import { useEffect, useRef } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBellRinging } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { playReminderChime } from './notificationSound';
import { getDueReminders } from './selectors';
import { useReminders } from './useReminders';

const CHECK_INTERVAL_MS = 15000;

function notificationId(reminderId: string) {
  return `reminder-${reminderId}`;
}

/** Mounted once at the app layout level — checks for due reminders and fires a persistent, unmissable alert. */
export function ReminderWatcher() {
  const { reminders, markNotified } = useReminders();
  const navigate = useNavigate();
  const firedRef = useRef(new Set<string>());

  useEffect(() => {
    const check = () => {
      const due = getDueReminders(reminders).filter((reminder) => !firedRef.current.has(reminder.id));
      for (const reminder of due) {
        firedRef.current.add(reminder.id);
        void markNotified(reminder.id);
        playReminderChime();

        const id = notificationId(reminder.id);
        notifications.show({
          id,
          autoClose: false,
          withCloseButton: true,
          color: 'orange',
          icon: <IconBellRinging size={20} />,
          title: 'Напоминание',
          message: (
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                {reminder.title}
              </Text>
              {reminder.message && (
                <Text size="xs" c="dimmed">
                  {reminder.message}
                </Text>
              )}
              <Group justify="flex-end" mt={4}>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    notifications.hide(id);
                    navigate('/calendar');
                  }}
                >
                  Открыть календарь
                </Button>
              </Group>
            </Stack>
          ),
        });
      }
    };

    check();
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [reminders, markNotified, navigate]);

  return null;
}
