import { useState } from 'react';
import { Button, Card, Checkbox, Group, Select, Stack, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import type { ObservationInput } from './useDispensary';
import { OUTCOME_LABELS } from './dispensaryUtils';
import type { DispensaryObservation, DispensaryOutcome } from './types';
import { useSaveAction } from '../../components/common/useSaveAction';

interface ObservationFormProps {
  initialObservation?: DispensaryObservation;
  onSubmit: (input: ObservationInput) => void | Promise<void>;
  onCancel: () => void;
}

const OUTCOME_OPTIONS = (Object.keys(OUTCOME_LABELS) as DispensaryOutcome[]).map((value) => ({ value, label: OUTCOME_LABELS[value] }));

export function ObservationForm({ initialObservation, onSubmit, onCancel }: ObservationFormProps) {
  const [date, setDate] = useState<string>(initialObservation?.date ?? dayjs().format('YYYY-MM-DD'));
  const [outcome, setOutcome] = useState<DispensaryOutcome>(initialObservation?.outcome ?? 'unchanged');
  const [ovl, setOvl] = useState(initialObservation?.ovl ?? false);
  const [sanatorium, setSanatorium] = useState(initialObservation?.sanatorium ?? false);
  const [campRest, setCampRest] = useState(initialObservation?.campRest ?? false);
  const [note, setNote] = useState(initialObservation?.note ?? '');

  const canSave = date.length > 0;

  const { saving, save } = useSaveAction(undefined, onSubmit);

  const handleSubmit = () => {
    if (!canSave) return;
    void save({ date, outcome, ovl, sanatorium, campRest, note: note.trim() });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group grow align="flex-start">
          <DatePickerInput label="Дата осмотра" value={date} onChange={(v) => setDate((v as string | null) ?? dayjs().format('YYYY-MM-DD'))} valueFormat="D MMMM YYYY" required />
          <Select label="Эффективность" data={OUTCOME_OPTIONS} value={outcome} onChange={(v) => setOutcome((v as DispensaryOutcome) ?? 'unchanged')} allowDeselect={false} />
        </Group>
        <Group>
          <Checkbox label="ОВЛ" checked={ovl} onChange={(e) => setOvl(e.currentTarget.checked)} />
          <Checkbox label="Санаторий" checked={sanatorium} onChange={(e) => setSanatorium(e.currentTarget.checked)} />
          <Checkbox label="Лагерь/база отдыха" checked={campRest} onChange={(e) => setCampRest(e.currentTarget.checked)} />
        </Group>
        <Textarea label="Заметка" placeholder="Коротко: жалобы, назначения, наблюдения" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize minRows={2} maxRows={6} />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={onCancel}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            {initialObservation ? 'Сохранить' : 'Добавить осмотр'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
