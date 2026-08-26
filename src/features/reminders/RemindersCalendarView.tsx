import { useMemo, useState } from 'react';
import { Badge, Button, Card, Grid, Group, Modal, ScrollArea, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconBellRinging, IconPlus } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { ReminderForm } from './ReminderForm';
import { getRemindersByDate } from './selectors';
import type { Reminder } from './types';
import type { ReminderInput } from './useReminders';
import { MarkedCalendar } from '../../components/common/MarkedCalendar';

interface RemindersCalendarViewProps {
  reminders: Reminder[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onCreate: (input: ReminderInput) => void;
  onUpdate: (id: string, input: ReminderInput) => void;
  onDelete: (id: string) => void;
}

export function RemindersCalendarView({
  reminders,
  selectedDate,
  onSelectDate,
  onCreate,
  onUpdate,
  onDelete,
}: RemindersCalendarViewProps) {
  const remindersByDate = useMemo(() => getRemindersByDate(reminders), [reminders]);
  const selectedReminders = remindersByDate.get(selectedDate) ?? [];

  const [modalOpened, setModalOpened] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const openCreate = () => {
    setEditingReminder(null);
    setModalOpened(true);
  };

  const openEdit = (reminder: Reminder) => {
    setEditingReminder(reminder);
    setModalOpened(true);
  };

  const closeModal = () => setModalOpened(false);

  const handleSubmit = (input: ReminderInput) => {
    if (editingReminder) onUpdate(editingReminder.id, input);
    else onCreate(input);
    closeModal();
  };

  const handleDelete = () => {
    if (editingReminder) onDelete(editingReminder.id);
    closeModal();
  };

  return (
    <>
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder padding="lg">
            <MarkedCalendar
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              entriesByDate={remindersByDate}
              dotColor="var(--mantine-color-orange-6)"
            />
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder padding="lg" h="100%">
            <Group justify="space-between" mb="md">
              <div>
                <Text fw={600} size="sm" tt="capitalize">
                  {dayjs(selectedDate).format('D MMMM YYYY, dddd')}
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedReminders.length > 0 ? `Напоминаний: ${selectedReminders.length}` : 'Нет напоминаний на этот день'}
                </Text>
              </div>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={openCreate}>
                Добавить
              </Button>
            </Group>

            {selectedReminders.length > 0 ? (
              <ScrollArea.Autosize mah={480}>
                <Stack gap="sm">
                  {selectedReminders.map((reminder) => (
                    <Card
                      key={reminder.id}
                      withBorder
                      padding="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openEdit(reminder)}
                    >
                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                          <ThemeIcon variant="light" color={reminder.notifiedAt ? 'gray' : 'orange'} size={30} radius="md">
                            <IconBellRinging size={16} />
                          </ThemeIcon>
                          <div style={{ minWidth: 0 }}>
                            <Text size="sm" fw={600} truncate>
                              {reminder.title}
                            </Text>
                            {reminder.message && (
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {reminder.message}
                              </Text>
                            )}
                          </div>
                        </Group>
                        <Badge variant="light" color="orange" size="sm">
                          {dayjs(reminder.datetime).format('HH:mm')}
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </ScrollArea.Autosize>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Выберите день и добавьте напоминание.
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <Modal opened={modalOpened} onClose={closeModal} title={editingReminder ? 'Напоминание' : 'Новое напоминание'} centered>
        <ReminderForm
          initialReminder={editingReminder ?? undefined}
          initialDate={selectedDate}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          onDelete={editingReminder ? handleDelete : undefined}
        />
      </Modal>
    </>
  );
}
