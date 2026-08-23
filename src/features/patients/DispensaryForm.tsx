import { useState } from 'react';
import { Button, Group, Select, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';

import { DiagnosisPicker } from './DiagnosisPicker';
import type { DispensaryRecord, Patient } from './types';
import type { DispensaryRecordInput } from './useDispensary';

interface DispensaryFormProps {
  patients: Patient[];
  initialRecord?: DispensaryRecord;
  defaultPatientId?: string;
  onSubmit: (input: DispensaryRecordInput) => void;
  onCancel: () => void;
}

export function DispensaryForm({ patients, initialRecord, defaultPatientId, onSubmit, onCancel }: DispensaryFormProps) {
  const [patientId, setPatientId] = useState<string | null>(initialRecord?.patientId ?? defaultPatientId ?? null);
  const [diagnosis, setDiagnosis] = useState(initialRecord?.diagnosis ?? '');
  const [diagnosisCode, setDiagnosisCode] = useState<string | undefined>(initialRecord?.diagnosisCode);
  const [registeredDate, setRegisteredDate] = useState<string>(initialRecord?.registeredDate ?? dayjs().format('YYYY-MM-DD'));
  const [nextVisitDate, setNextVisitDate] = useState<string | null>(initialRecord?.nextVisitDate ?? null);

  const canSave = patientId !== null && diagnosis.trim().length > 0 && registeredDate.length > 0;

  const handleSubmit = () => {
    if (!canSave || patientId === null) return;
    onSubmit({
      patientId,
      diagnosis: diagnosis.trim(),
      diagnosisCode,
      registeredDate,
      nextVisitDate,
    });
  };

  return (
    <Stack gap="md">
      <Select
        label="Пациент"
        placeholder="Выберите пациента"
        data={patients.map((p) => ({ value: p.id, label: p.fullName }))}
        value={patientId}
        onChange={setPatientId}
        searchable
        required
      />
      <DiagnosisPicker
        value={diagnosis}
        onChange={(value, code) => {
          setDiagnosis(value);
          setDiagnosisCode(code);
        }}
      />
      <Group grow align="flex-start">
        <DatePickerInput
          label="Дата взятия на учёт"
          value={registeredDate}
          onChange={(v) => setRegisteredDate((v as string | null) ?? dayjs().format('YYYY-MM-DD'))}
          valueFormat="D MMMM YYYY"
          required
        />
        <DatePickerInput
          label="Дата ближайшего осмотра"
          placeholder="Не задана"
          value={nextVisitDate}
          onChange={(v) => setNextVisitDate(v as string | null)}
          valueFormat="D MMMM YYYY"
          clearable
        />
      </Group>

      <Group justify="flex-end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Отмена
        </Button>
        <Button onClick={handleSubmit} disabled={!canSave}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
