import { useState } from 'react';
import { Button, Card, Group, Select, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import type { DispensaryRemovalReason } from './types';
import { REMOVAL_REASON_LABELS } from './dispensaryUtils';
import { useSaveAction } from '../../components/common/useSaveAction';

interface RemovalFormProps {
  onSubmit: (date: string, reason: DispensaryRemovalReason) => void | Promise<void>;
  onCancel: () => void;
}

const REASON_OPTIONS = (Object.keys(REMOVAL_REASON_LABELS) as DispensaryRemovalReason[]).map((value) => ({
  value,
  label: REMOVAL_REASON_LABELS[value],
}));

export function RemovalForm({ onSubmit, onCancel }: RemovalFormProps) {
  const [date, setDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [reason, setReason] = useState<DispensaryRemovalReason>('recovered');

  const { saving, save } = useSaveAction(undefined, onSubmit);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group grow align="flex-start">
          <DatePickerInput label="Дата снятия с учёта" value={date} onChange={(v) => setDate((v as string | null) ?? dayjs().format('YYYY-MM-DD'))} valueFormat="D MMMM YYYY" required />
          <Select label="Причина" data={REASON_OPTIONS} value={reason} onChange={(v) => setReason((v as DispensaryRemovalReason) ?? 'recovered')} allowDeselect={false} />
        </Group>
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={onCancel}>
            Отмена
          </Button>
          <Button size="sm" color="gray" onClick={() => void save(date, reason)} loading={saving}>
            Снять с учёта
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
