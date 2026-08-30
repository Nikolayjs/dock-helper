import { useState } from 'react';
import dayjs from 'dayjs';

import { useDirtyValue, useUnsavedGuard } from '../../components/common/unsavedChanges';
import { useSaveAction } from '../../components/common/useSaveAction';
import { Button, Divider, Group, NumberInput, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconTrash } from '@tabler/icons-react';

import type { Patient, PatientSex } from './types';
import type { PatientInput } from './usePatients';
import { FormActions } from '../../components/common/FormActions';

const SEX_OPTIONS: { value: PatientSex; label: string }[] = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

interface PatientFormProps {
  initialPatient?: Patient;
  onSubmit: (input: PatientInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PatientForm({ initialPatient, onSubmit, onCancel, onDelete }: PatientFormProps) {
  const [fullName, setFullName] = useState(initialPatient?.fullName ?? '');
  const [sex, setSex] = useState<PatientSex | null>(initialPatient?.sex ?? null);
  const [birthDate, setBirthDate] = useState<string | null>(initialPatient?.birthDate ?? null);
  const [phone, setPhone] = useState(initialPatient?.phone ?? '');
  const [reminderDate, setReminderDate] = useState<string | null>(initialPatient?.reminderDate ?? null);
  const [reminderNote, setReminderNote] = useState(initialPatient?.reminderNote ?? '');
  const [heightCm, setHeightCm] = useState<number | ''>(initialPatient?.heightCm ?? '');
  const [weightKg, setWeightKg] = useState<number | ''>(initialPatient?.weightKg ?? '');
  const [measuredAt, setMeasuredAt] = useState<string | null>(initialPatient?.measuredAt ?? null);
  const [allergies, setAllergies] = useState(initialPatient?.allergies ?? '');
  const [insurancePolicy, setInsurancePolicy] = useState(initialPatient?.insurancePolicy ?? '');
  const [district, setDistrict] = useState(initialPatient?.district ?? '');
  const [address, setAddress] = useState(initialPatient?.address ?? '');

  /**
   * Первое введённое измерение проставляет сегодняшнюю дату — **видимо, прямо в поле**.
   *
   * Вес без даты опаснее, чем отсутствие веса: по нему считают дозу и клиренс, и число, введённое
   * год назад, ничем себя не выдаёт. Подставлять молча тоже нельзя — поэтому дата появляется на
   * экране, её видно и можно поправить: измеряли-то обычно сегодня, но бланк приносят и позже.
   */
  const noteMeasurement = (next: number | '') => {
    if (next !== '' && measuredAt === null) setMeasuredAt(dayjs().format('YYYY-MM-DD'));
  };

  const canSave = fullName.trim().length > 0;

  const guard = useUnsavedGuard(
    useDirtyValue({
      fullName, sex, birthDate, phone, reminderDate, reminderNote,
      heightCm, weightKg, measuredAt, allergies, insurancePolicy, district, address,
    }),
  );
  const { saving, save } = useSaveAction(guard, onSubmit);

  const handleSubmit = () => {
    if (!canSave) return;
    void save({
      fullName: fullName.trim(),
      sex,
      birthDate,
      phone: phone.trim(),
      reminderDate,
      reminderNote: reminderNote.trim(),
      heightCm: heightCm === '' ? null : heightCm,
      weightKg: weightKg === '' ? null : weightKg,
      // Дата измерения без самих измерений ни о чём: она про них, а не про приём.
      measuredAt: heightCm === '' && weightKg === '' ? null : measuredAt,
      allergies: allergies.trim(),
      insurancePolicy: insurancePolicy.trim(),
      district: district.trim(),
      address: address.trim(),
    });
  };

  return (
    <Stack gap="md">
      <TextInput label="ФИО" placeholder="Например: Соколова Мария Ивановна" value={fullName} onChange={(e) => setFullName(e.currentTarget.value)} required />
      <Group grow>
        <Select
          label="Пол"
          placeholder="Не указан"
          data={SEX_OPTIONS}
          value={sex}
          onChange={(v) => setSex(v as PatientSex | null)}
          clearable
        />
        <DatePickerInput label="Дата рождения" placeholder="Не указана" value={birthDate} onChange={(v) => setBirthDate(v as string | null)} clearable valueFormat="D MMMM YYYY" />
        <TextInput label="Телефон" placeholder="Необязательно" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
      </Group>

      <Divider label="Антропометрия" labelPosition="left" />
      <Group grow align="flex-start">
        <NumberInput
          label="Рост, см"
          placeholder="Не измерен"
          value={heightCm}
          onChange={(v) => {
            const next = v === '' ? '' : Number(v);
            setHeightCm(next);
            noteMeasurement(next);
          }}
          min={0}
          max={300}
          decimalScale={0}
        />
        <NumberInput
          label="Вес, кг"
          placeholder="Не измерен"
          value={weightKg}
          onChange={(v) => {
            const next = v === '' ? '' : Number(v);
            setWeightKg(next);
            noteMeasurement(next);
          }}
          min={0}
          max={500}
          decimalScale={1}
          step={0.5}
        />
        {/* Дата у роста и веса общая: их и измеряют за один приём, на одних весах с ростомером.
            Без неё вес — число, про которое неизвестно, сегодняшнее оно или позапрошлогоднее, а по
            нему считают дозу, ИМТ и клиренс креатинина. */}
        <DatePickerInput
          label="Измерено"
          placeholder="Дата измерения"
          description="Проставляется сегодняшним числом — поправьте, если мерили раньше"
          value={measuredAt}
          onChange={(v) => setMeasuredAt(v as string | null)}
          clearable
          valueFormat="D MMMM YYYY"
        />
      </Group>

      <Divider label="Аллергии и непереносимость" labelPosition="left" />
      {/* Свободным текстом, а не списком препаратов: сюда пишут и пыльцу, и латекс, и йод, и
          «отёк Квинке на что-то из пенициллинов, что именно — не помнит». Список со строгими
          карточками формуляра принял бы из этого меньше половины. */}
      <Textarea
        label="Что и как проявляется"
        placeholder="Например: пенициллины — отёк Квинке; пыльца берёзы — сезонный ринит"
        value={allergies}
        onChange={(e) => setAllergies(e.currentTarget.value)}
        autosize
        minRows={2}
      />

      <Divider label="Учётные данные" labelPosition="left" />
      <Group grow align="flex-start">
        <TextInput label="Полис ОМС" placeholder="Необязательно" value={insurancePolicy} onChange={(e) => setInsurancePolicy(e.currentTarget.value)} />
        <TextInput label="Участок" placeholder="Например: 7" value={district} onChange={(e) => setDistrict(e.currentTarget.value)} />
      </Group>
      <TextInput label="Адрес" placeholder="Необязательно" value={address} onChange={(e) => setAddress(e.currentTarget.value)} />

      <Divider label="Напоминание о следующем визите" labelPosition="left" />
      <Group grow align="flex-start">
        <DatePickerInput label="Дата" placeholder="Без напоминания" value={reminderDate} onChange={(v) => setReminderDate(v as string | null)} clearable valueFormat="D MMMM YYYY" />
        <TextInput label="Комментарий" placeholder="Например: контроль анализов" value={reminderNote} onChange={(e) => setReminderNote(e.currentTarget.value)} />
      </Group>
      <Text size="xs" c="dimmed">
        Появится как отметка на карточке пациента — это просто личный напоминатель, без уведомлений.
      </Text>

      {guard.render({ onSave: canSave ? handleSubmit : undefined })}

      <FormActions>
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
            <Button onClick={handleSubmit} loading={saving} disabled={!canSave}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </FormActions>
    </Stack>
  );

}
