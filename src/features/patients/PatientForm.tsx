import { useState } from 'react';
import { Button, Divider, Group, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconTrash } from '@tabler/icons-react';

import type { Patient } from './types';
import type { PatientInput } from './usePatients';

interface PatientFormProps {
  initialPatient?: Patient;
  onSubmit: (input: PatientInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PatientForm({ initialPatient, onSubmit, onCancel, onDelete }: PatientFormProps) {
  const [fullName, setFullName] = useState(initialPatient?.fullName ?? '');
  const [birthDate, setBirthDate] = useState<string | null>(initialPatient?.birthDate ?? null);
  const [phone, setPhone] = useState(initialPatient?.phone ?? '');
  const [reminderDate, setReminderDate] = useState<string | null>(initialPatient?.reminderDate ?? null);
  const [reminderNote, setReminderNote] = useState(initialPatient?.reminderNote ?? '');

  const canSave = fullName.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({
      fullName: fullName.trim(),
      birthDate,
      phone: phone.trim(),
      reminderDate,
      reminderNote: reminderNote.trim(),
    });
  };

  return (
    <Stack gap="md">
      <TextInput label="ФИО" placeholder="Например: Соколова Мария Ивановна" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} required />
      <Group grow>
        <DatePickerInput label="Дата рождения" placeholder="Не указана" value={birthDate} onChange={(v) => setBirthDate(v as string | null)} clearable valueFormat="D MMMM YYYY" />
        <TextInput label="Телефон" placeholder="Необязательно" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
      </Group>

      <Divider label="Напоминание о следующем визите" labelPosition="left" />
      <Group grow align="flex-start">
        <DatePickerInput label="Дата" placeholder="Без напоминания" value={reminderDate} onChange={(v) => setReminderDate(v as string | null)} clearable valueFormat="D MMMM YYYY" />
        <TextInput label="Комментарий" placeholder="Например: контроль анализов" value={reminderNote} onChange={(e) => setReminderNote(e.currentTarget.value)} />
      </Group>
      <Text size="xs" c="dimmed">
        Появится как отметка на карточке пациента — это просто личный напоминатель, без уведомлений.
      </Text>

      <Group justify="space-between" mt="sm">
        {initialPatient && onDelete ? (
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
