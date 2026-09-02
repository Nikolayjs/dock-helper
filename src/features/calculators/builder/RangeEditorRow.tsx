import { ActionIcon, Grid, Group, NumberInput, Select, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import type { InterpretationRange } from '../types';

const COLOR_OPTIONS = [
  { value: 'teal', label: 'Зелёный' },
  { value: 'mint', label: 'Мятный' },
  { value: 'yellow', label: 'Жёлтый' },
  { value: 'orange', label: 'Оранжевый' },
  { value: 'red', label: 'Красный' },
  { value: 'blue', label: 'Синий' },
  { value: 'brand', label: 'Фирменный' },
  { value: 'grape', label: 'Фиолетовый' },
  { value: 'gray', label: 'Серый' },
];

interface RangeEditorRowProps {
  range: InterpretationRange;
  onChange: (range: InterpretationRange) => void;
  onRemove: () => void;
}

export function RangeEditorRow({ range, onChange, onRemove }: RangeEditorRowProps) {
  return (
    <Grid align="center">
      <Grid.Col span={{ base: 6, sm: 2 }}>
        <NumberInput
          placeholder="от (включая)"
          value={range.min ?? ''}
          onChange={(v) => onChange({ ...range, min: v === '' ? undefined : Number(v) })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 6, sm: 2 }}>
        <NumberInput
          placeholder="до (не включая)"
          value={range.max ?? ''}
          onChange={(v) => onChange({ ...range, max: v === '' ? undefined : Number(v) })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput
          placeholder="Название, например «Норма»"
          value={range.label}
          onChange={(e) => onChange({ ...range, label: e.currentTarget.value })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 9, sm: 3 }}>
        <Select data={COLOR_OPTIONS} value={range.color} allowDeselect={false} onChange={(v) => onChange({ ...range, color: v ?? 'brand' })} />
      </Grid.Col>
      <Grid.Col span={{ base: 3, sm: 1 }}>
        <Group justify="flex-end">
          <ActionIcon aria-label="Удалить" color="red" variant="subtle" onClick={onRemove} radius="md">
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Grid.Col>
    </Grid>
  );
}
