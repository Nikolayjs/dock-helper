import { useMemo, useState } from 'react';
import { Autocomplete, Button, Card, Group, Stack, Text, TextInput } from '@mantine/core';

import { useSaveAction } from '../../components/common/useSaveAction';
import { useDrugSearch } from '../drugs/useDrugSearch';
import { drugOptions } from './drugSuggestions';
import type { PatientMedication } from './types';

export interface MedicationDraft {
  name: string;
  dose: string;
  note: string;
}

interface MedicationFormProps {
  initialMedication?: PatientMedication;
  onSubmit: (draft: MedicationDraft) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Строка постоянной терапии: название, доза, заметка.
 *
 * **Названия подсказывает сервер** (`useDrugSearch`), а не загруженный формуляр. Причина та же, по
 * которой на сервер уехал поиск в шапке: `useDrugs()` здесь означал бы 21 КБ gzip полутора тысяч
 * карточек при каждом открытии карточки пациента — а открывают её на каждом приёме, и препараты
 * записывают далеко не всем.
 *
 * Поле остаётся **свободным**: подсказка помогает, но не ограничивает. Врач записывает и то, чего
 * в формуляре нет вовсе, — фитопрепарат, добавку, безрецептурную комбинацию; список, который нельзя
 * заполнить до конца, не заполняют вообще.
 */
export function MedicationForm({ initialMedication, onSubmit, onCancel }: MedicationFormProps) {
  const [name, setName] = useState(initialMedication?.name ?? '');
  const [dose, setDose] = useState(initialMedication?.dose ?? '');
  const [note, setNote] = useState(initialMedication?.note ?? '');

  const { drugs } = useDrugSearch(name, 6);
  const options = useMemo(() => drugOptions(drugs, name), [drugs, name]);
  /**
   * МНН показывается рядом с вариантом и **не** входит в его подпись.
   *
   * У `Autocomplete` из Mantine нет пары «значение — подпись»: выбранный вариант вставляется своей
   * подписью целиком. Со строкой «Кардиомагнил · Ацетилсалициловая кислота» в подписи в карту
   * попадало ровно это, и проверка отвечала «нет в справочнике».
   */
  const innOf = useMemo(
    () => new Map(options.filter((option) => option.inn).map((option) => [option.value, option.inn!])),
    [options],
  );

  const canSave = name.trim().length > 0;
  const { saving, save } = useSaveAction(undefined, onSubmit);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group grow align="flex-start">
          <Autocomplete
            label="Препарат"
            placeholder="МНН или торговое название"
            data={options.map((option) => option.value)}
            renderOption={({ option }) => (
              <Group gap={6} wrap="nowrap">
                <Text size="sm">{option.value}</Text>
                {innOf.get(option.value) && (
                  <Text size="xs" c="dimmed" truncate>
                    · {innOf.get(option.value)}
                  </Text>
                )}
              </Group>
            )}
            value={name}
            onChange={setName}
            // Отбор уже сделал сервер — и по МНН, и по торговым названиям. Повторный, по самой
            // строке варианта, выбросил бы «Конкор» у того, кто набрал «бисопролол»: искали одно,
            // а сверяют с другим.
            filter={({ options: shown }) => shown}
            comboboxProps={{ withinPortal: true }}
            data-autofocus
            required
          />
          <TextInput
            label="Доза и режим"
            placeholder="5 мг утром"
            value={dose}
            onChange={(event) => setDose(event.currentTarget.value)}
          />
        </Group>
        <TextInput
          label="Заметка"
          placeholder="Кем назначен, с какого времени, чем контролируется"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" size="xs" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            size="xs"
            loading={saving}
            disabled={!canSave}
            onClick={() => void save({ name: name.trim(), dose: dose.trim(), note: note.trim() })}
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
