import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Select, Stack, Text, Textarea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { useSaveAction } from '../../components/common/useSaveAction';
import type { Sex } from '../analyzer/types';
import { usePatients } from '../patients/usePatients';
import { panelValues } from './panels';
import type { FilledPanel } from './panels';
import type { LabResultInput } from './types';
import { useLabResults } from './useLabResults';

interface SaveToChartModalProps {
  opened: boolean;
  onClose: () => void;
  /** Записано в карту: страница разбора снимает с себя охрану несохранённого. */
  onSaved?: () => void;
  panels: FilledPanel[];
  /** Панель, открытая на экране: она отмечена всегда, остальные — тоже, но их видно списком. */
  activeTestId?: string;
  sex: Sex;
  age?: number;
  patientId?: string | null;
}

/**
 * Оболочка окна. Форма внутри монтируется заново на каждое открытие — и это не мелочь: иначе окно,
 * закрытое и открытое второй раз, помнило бы прошлую дату и прошлый выбор панелей, а между этими
 * двумя разами врач мог сменить и пациента, и набранное. Сбрасывать то же самое эффектом значило бы
 * лишний раз перерисовать форму ради состояния, которого при новом монтировании и так не будет.
 */
export function SaveToChartModal({ opened, onClose, ...rest }: SaveToChartModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Сохранить в карту пациента" size="lg" radius="md">
      {opened && <SaveToChartForm onClose={onClose} {...rest} />}
    </Modal>
  );
}

function SaveToChartForm({ onClose, onSaved, panels, activeTestId, sex, age, patientId }: Omit<SaveToChartModalProps, 'opened'>) {
  const { patients } = usePatients();
  const { addResult } = useLabResults();

  const [selectedPatient, setSelectedPatient] = useState<string | null>(patientId ?? null);
  const [takenAt, setTakenAt] = useState(dayjs().format('YYYY-MM-DD'));
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState<string[]>(() => panels.map((panel) => panel.test.id));

  const counts = useMemo(
    () => new Map(panels.map((panel) => [panel.test.id, panelValues(panel).length])),
    [panels],
  );

  const canSave = Boolean(selectedPatient) && takenAt.length > 0 && chosen.length > 0;

  const { saving, save } = useSaveAction(undefined, async () => {
    if (!selectedPatient) return;
    const saved = panels.filter((panel) => chosen.includes(panel.test.id));

    for (const panel of saved) {
      const input: LabResultInput = {
        patientId: selectedPatient,
        analyzerId: panel.test.id,
        analyzerTitle: panel.test.title,
        takenAt,
        sex,
        ageYears: age ?? null,
        values: panelValues(panel),
        note: note.trim(),
      };
      await addResult(input);
    }

    notifications.show({
      message: saved.length === 1 ? 'Анализ сохранён в карту пациента' : `Сохранено бланков: ${saved.length}`,
      color: 'teal',
    });
    onSaved?.();
    onClose();
  });

  return (
    <Stack gap="md">
      <Select
        label="Пациент"
        placeholder="Выберите пациента"
        data={patients.map((patient) => ({ value: patient.id, label: patient.fullName }))}
        value={selectedPatient}
        onChange={setSelectedPatient}
        searchable
        nothingFoundMessage="Никого не найдено"
        required
      />

      <DatePickerInput
        label="Дата анализа"
        description="Та, что стоит на бланке, — не сегодняшняя, если бланк принесли позже"
        value={takenAt}
        onChange={(value) => setTakenAt((value as string | null) ?? dayjs().format('YYYY-MM-DD'))}
        valueFormat="D MMMM YYYY"
        required
      />

      {/* Панелей может быть несколько: файл из лаборатории обычно покрывает и общий анализ крови,
          и биохимию сразу. Сохранить молча только открытую вкладку значило бы потерять остальные
          — тихо и незаметно, потому что на экране в этот момент видна одна. */}
      <Checkbox.Group
        label={panels.length > 1 ? 'Что сохранить' : 'Бланк'}
        description={panels.length > 1 ? 'Каждая панель сохраняется отдельным бланком с этой же датой' : undefined}
        value={chosen}
        onChange={setChosen}
      >
        <Stack gap="xs" mt="xs">
          {panels.map((panel) => (
            <Checkbox
              key={panel.test.id}
              value={panel.test.id}
              label={
                <Text size="sm">
                  {panel.test.title}
                  <Text span c="dimmed">
                    {' '}
                    · показателей: {counts.get(panel.test.id) ?? 0}
                    {panel.test.id === activeTestId && panels.length > 1 ? ' · открыта' : ''}
                  </Text>
                </Text>
              }
            />
          ))}
        </Stack>
      </Checkbox.Group>

      <Textarea
        label="Заметка"
        placeholder="Например: лаборатория, повод, самочувствие"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        autosize
        minRows={2}
      />

      {/* Толкование не сохраняется, и об этом лучше сказать заранее: врач вправе ждать, что в
          карте лежит именно то заключение, которое он сейчас видит. */}
      <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
        В карту сохраняются значения, пол и возраст, по которым брались нормы. Заключения считаются
        заново при каждом открытии — исправленная норма дойдёт и до уже сохранённых бланков.
      </Alert>

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => void save()} loading={saving} disabled={!canSave}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
