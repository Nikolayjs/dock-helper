import { ActionIcon, Card, Grid, Group, NumberInput, Select, Text, TextInput } from '@mantine/core';
import { IconGripVertical, IconTrash } from '@tabler/icons-react';

import type { CalculatorPreset, CalculatorPresetValue } from '../types';
import type { DraftField } from './FieldEditorRow';

export interface DraftPreset extends CalculatorPreset {
  uid: string;
}

export function createDraftPreset(): DraftPreset {
  return { uid: crypto.randomUUID(), id: crypto.randomUUID(), label: '', values: [] };
}

interface PresetEditorRowProps {
  preset: DraftPreset;
  fields: DraftField[];
  onChange: (preset: DraftPreset) => void;
  onRemove: () => void;
}

export function PresetEditorRow({ preset, fields, onChange, onRemove }: PresetEditorRowProps) {
  const setFieldValue = (fieldKey: string, value: number | undefined) => {
    const rest = preset.values.filter((v) => v.fieldKey !== fieldKey);
    const values: CalculatorPresetValue[] = value === undefined ? rest : [...rest, { fieldKey, value }];
    onChange({ ...preset, values });
  };

  const valueFor = (fieldKey: string) => preset.values.find((v) => v.fieldKey === fieldKey)?.value;

  const fillableFields = fields.filter((f) => f.key.trim() && f.label.trim());

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={6} c="dimmed">
          <IconGripVertical size={16} />
          <Text size="xs" fw={600} tt="uppercase">
            Пресет
          </Text>
        </Group>
        <ActionIcon aria-label="Удалить" color="red" variant="subtle" onClick={onRemove} radius="md">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <TextInput
        label="Название пресета"
        placeholder="Например: Амоксиклав 125/5 (40 мг/кг)"
        value={preset.label}
        onChange={(e) => onChange({ ...preset, label: e.currentTarget.value })}
        mb="sm"
      />

      {fillableFields.length === 0 ? (
        <Text size="sm" c="dimmed">
          Сначала добавьте поля ввода — тогда здесь можно будет выбрать, какие значения подставлять.
        </Text>
      ) : (
        <>
          <Text size="sm" fw={500} mb={6}>
            Что подставлять при выборе этого пресета
          </Text>
          <Grid>
            {fillableFields.map((field) =>
              field.type === 'select' ? (
                <Grid.Col key={field.uid} span={{ base: 12, sm: 6 }}>
                  <Select
                    label={field.label}
                    placeholder="Не менять"
                    clearable
                    data={(field.options ?? []).map((o) => ({ label: o.label || String(o.value), value: String(o.value) }))}
                    value={valueFor(field.key) !== undefined ? String(valueFor(field.key)) : null}
                    onChange={(v) => setFieldValue(field.key, v === null ? undefined : Number(v))}
                  />
                </Grid.Col>
              ) : (
                <Grid.Col key={field.uid} span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label={field.label}
                    placeholder="Не менять"
                    suffix={field.unit ? ` ${field.unit}` : undefined}
                    value={valueFor(field.key) ?? ''}
                    onChange={(v) => setFieldValue(field.key, v === '' ? undefined : Number(v))}
                  />
                </Grid.Col>
              ),
            )}
          </Grid>
        </>
      )}
    </Card>
  );
}
