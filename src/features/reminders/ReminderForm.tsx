import { useState } from 'react';
import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import type { Reminder } from './types';
import type { ReminderInput } from './useReminders';

interface ReminderFormProps {
  initialReminder?: Reminder;
  initialDate?: string;
  onSubmit: (input: ReminderInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function ReminderForm({ initialReminder, initialDate, onSubmit, onCancel, onDelete }: ReminderFormProps) {
  const [title, setTitle] = useState(initialReminder?.title ?? '');
  const [message, setMessage] = useState(initialReminder?.message ?? '');
  const [date, setDate] = useState(
    initialReminder ? dayjs(initialReminder.datetime).format('YYYY-MM-DD') : (initialDate ?? dayjs().format('YYYY-MM-DD')),
  );
  const [time, setTime] = useState(initialReminder ? dayjs(initialReminder.datetime).format('HH:mm') : '09:00');

  const canSave = title.trim().length > 0 && Boolean(date) && Boolean(time);

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({
      title: title.trim(),
      message: message.trim(),
      datetime: `${date}T${time}`,
    });
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Название"
        placeholder="Например: Позвонить пациенту"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
        autoFocus
      />
      <Textarea
        label="Комментарий"
        placeholder="Необязательно"
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
        minRows={2}
        autosize
      />
      <Group grow align="flex-start">
        <TextInput type="date" label="Дата" value={date} onChange={(e) => setDate(e.currentTarget.value)} required />
        <TimeInput label="Время" value={time} onChange={(e) => setTime(e.currentTarget.value)} required />
      </Group>

      <Group justify="space-between" mt="sm">
        {initialReminder && onDelete ? (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
            Удалить
          </Button>
        ) : (
          <div />
        )}
        <Group>
          <Button variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            Сохранить
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
