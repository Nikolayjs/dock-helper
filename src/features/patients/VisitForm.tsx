import { useState } from 'react';
import { Button, Card, Group, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { DiagnosisPicker } from './DiagnosisPicker';
import { REFERRAL_CATEGORY_OPTIONS } from './referralUtils';
import type { PatientVisit, ReferralCategory } from './types';
import type { VisitInput } from './usePatients';
import { useSaveAction } from '../../components/common/useSaveAction';

interface VisitFormProps {
  initialVisit?: PatientVisit;
  onSubmit: (input: VisitInput) => void | Promise<void>;
  onCancel: () => void;
}

export function VisitForm({ initialVisit, onSubmit, onCancel }: VisitFormProps) {
  const [date, setDate] = useState<string>(initialVisit?.date ?? dayjs().format('YYYY-MM-DD'));
  const [diagnosis, setDiagnosis] = useState(initialVisit?.diagnosis ?? '');
  const [diagnosisCode, setDiagnosisCode] = useState<string | undefined>(initialVisit?.diagnosisCode);
  const [note, setNote] = useState(initialVisit?.note ?? '');
  const [referralCategory, setReferralCategory] = useState<ReferralCategory | null>(initialVisit?.referralCategory ?? null);
  const [referralDestination, setReferralDestination] = useState(initialVisit?.referralDestination ?? '');

  const canSave = date.length > 0;

  const { saving, save } = useSaveAction(undefined, onSubmit);

  const handleSubmit = () => {
    if (!canSave) return;
    void save({
      date,
      diagnosis: diagnosis.trim(),
      diagnosisCode,
      note: note.trim(),
      referralCategory,
      referralDestination: referralCategory ? referralDestination.trim() : '',
    });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group grow align="flex-start">
          <DatePickerInput label="Дата визита" value={date} onChange={(v) => setDate((v as string | null) ?? dayjs().format('YYYY-MM-DD'))} valueFormat="D MMMM YYYY" required />
          <DiagnosisPicker
            value={diagnosis}
            onChange={(value, code) => {
              setDiagnosis(value);
              setDiagnosisCode(code);
            }}
          />
        </Group>
        <Group grow align="flex-start">
          <Select
            label="Направление"
            placeholder="Без направления"
            data={REFERRAL_CATEGORY_OPTIONS}
            value={referralCategory}
            onChange={(v) => setReferralCategory(v as ReferralCategory | null)}
            clearable
          />
          {referralCategory && (
            <TextInput
              label="Куда направлен"
              placeholder="Например: ГКБ №1"
              value={referralDestination}
              onChange={(e) => setReferralDestination(e.currentTarget.value)}
            />
          )}
        </Group>
        <Textarea label="Заметка" placeholder="Коротко: жалобы, назначения, наблюдения" value={note} onChange={(e) => setNote(e.currentTarget.value)} autosize minRows={2} maxRows={6} />
        <Group justify="flex-end">
          <Button variant="default" size="sm" onClick={onCancel}>
            Отмена
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving} disabled={!canSave}>
            {initialVisit ? 'Сохранить' : 'Добавить визит'}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
