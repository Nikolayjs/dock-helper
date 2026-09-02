import { ActionIcon, Card, Grid, Group, Slider, Text, TextInput, Tooltip } from '@mantine/core';
import { IconInfoCircle, IconTrash } from '@tabler/icons-react';

import type { Symptom } from '../types';

export interface DraftSymptom extends Symptom {
  uid: string;
}

interface SymptomPoolEditorProps {
  symptom: DraftSymptom;
  onChange: (symptom: DraftSymptom) => void;
  onRemove: () => void;
  labelError?: string;
}

export function SymptomPoolEditor({ symptom, onChange, onRemove, labelError }: SymptomPoolEditorProps) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Grid align="center">
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            placeholder="Например: Периодическая лихорадка"
            value={symptom.label}
            error={labelError}
            onChange={(e) => onChange({ ...symptom, label: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 9, sm: 5 }}>
          <Group gap={6} wrap="nowrap">
            <Tooltip
              multiline
              w={260}
              label="Насколько часто этот симптом встречается вообще, у любого заболевания. Используется, только если для конкретного заболевания частота не указана явно."
            >
              <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" />
            </Tooltip>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              Общая частота: {Math.round(symptom.generalPrevalence * 100)}%
            </Text>
          </Group>
          <Slider
            min={0}
            max={100}
            value={Math.round(symptom.generalPrevalence * 100)}
            onChange={(v) => onChange({ ...symptom, generalPrevalence: v / 100 })}
            label={(v) => `${v}%`}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 3, sm: 1 }}>
          <Group justify="flex-end">
            <ActionIcon aria-label="Удалить" color="red" variant="subtle" onClick={onRemove} radius="md">
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
