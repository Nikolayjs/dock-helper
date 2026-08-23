import { ActionIcon, Card, Grid, Group, NumberInput, Select, Text, TextInput } from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import type { CalculatorField, CalculatorFieldOption } from '../types';

export interface DraftField extends CalculatorField {
  uid: string;
}

interface FieldEditorRowProps {
  field: DraftField;
  onChange: (field: DraftField) => void;
  onRemove: () => void;
  keyError?: string;
}

export function FieldEditorRow({ field, onChange, onRemove, keyError }: FieldEditorRowProps) {
  const updateOption = (index: number, option: CalculatorFieldOption) => {
    const options = [...(field.options ?? [])];
    options[index] = option;
    onChange({ ...field, options });
  };

  const addOption = () => {
    const options = [...(field.options ?? []), { label: '', value: 0 }];
    onChange({ ...field, options });
  };

  const removeOption = (index: number) => {
    const options = (field.options ?? []).filter((_, i) => i !== index);
    onChange({ ...field, options });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={6} c="dimmed">
          <IconGripVertical size={16} />
          <Text size="xs" fw={600} tt="uppercase">
            Поле
          </Text>
        </Group>
        <ActionIcon color="red" variant="subtle" onClick={onRemove} radius="md">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Название поля"
            placeholder="Например: Вес"
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Переменная в формуле"
            placeholder="weight"
            value={field.key}
            error={keyError}
            onChange={(e) => onChange({ ...field, key: e.currentTarget.value })}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Тип поля"
            data={[
              { value: 'number', label: 'Число' },
              { value: 'select', label: 'Список выбора' },
            ]}
            value={field.type}
            allowDeselect={false}
            onChange={(val) =>
              onChange({
                ...field,
                type: (val as 'number' | 'select') ?? 'number',
                options: val === 'select' ? field.options ?? [{ label: '', value: 0 }] : undefined,
              })
            }
          />
        </Grid.Col>

        {field.type === 'number' && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Единицы измерения"
              placeholder="кг"
              value={field.unit ?? ''}
              onChange={(e) => onChange({ ...field, unit: e.currentTarget.value })}
            />
          </Grid.Col>
        )}

        {field.type === 'number' && (
          <>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Мин."
                value={field.min ?? ''}
                onChange={(v) => onChange({ ...field, min: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Макс."
                value={field.max ?? ''}
                onChange={(v) => onChange({ ...field, max: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Шаг"
                value={field.step ?? ''}
                onChange={(v) => onChange({ ...field, step: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="По умолчанию"
                value={field.defaultValue ?? ''}
                onChange={(v) => onChange({ ...field, defaultValue: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
          </>
        )}

        {field.type === 'select' && (
          <Grid.Col span={12}>
            <Text size="sm" fw={500} mb={6}>
              Варианты выбора
            </Text>
            <Group gap="xs" align="flex-start" wrap="wrap">
              {(field.options ?? []).map((option, index) => (
                <Group key={index} gap={4} wrap="nowrap" align="flex-end">
                  <TextInput
                    placeholder="Название"
                    size="sm"
                    value={option.label}
                    onChange={(e) => updateOption(index, { ...option, label: e.currentTarget.value })}
                  />
                  <NumberInput
                    placeholder="Значение"
                    size="sm"
                    w={100}
                    value={option.value}
                    onChange={(v) => updateOption(index, { ...option, value: Number(v) || 0 })}
                  />
                  <ActionIcon variant="subtle" color="red" onClick={() => removeOption(index)}>
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              ))}
              <ActionIcon variant="light" color="brand" onClick={addOption} size="lg" radius="md">
                <IconPlus size={16} />
              </ActionIcon>
            </Group>
          </Grid.Col>
        )}
      </Grid>
    </Card>
  );
}
