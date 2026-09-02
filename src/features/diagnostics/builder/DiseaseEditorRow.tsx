import { ActionIcon, Card, Grid, Group, NumberInput, Select, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { IconGripVertical, IconInfoCircle, IconTrash } from '@tabler/icons-react';

import { FREQUENCY_LABELS } from '../types';
import type { Disease, SymptomFrequency } from '../types';

export interface DraftDisease extends Disease {
  uid: string;
}

interface PoolSymptom {
  id: string;
  label: string;
}

interface DiseaseEditorRowProps {
  disease: DraftDisease;
  symptomPool: PoolSymptom[];
  onChange: (disease: DraftDisease) => void;
  onRemove: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: '', label: 'Не указано' },
  ...(Object.keys(FREQUENCY_LABELS) as SymptomFrequency[]).map((value) => ({ value, label: FREQUENCY_LABELS[value] })),
];

export function DiseaseEditorRow({ disease, symptomPool, onChange, onRemove }: DiseaseEditorRowProps) {
  const setFrequency = (symptomId: string, frequency: SymptomFrequency | '') => {
    const withoutSymptom = disease.symptomLinks.filter((l) => l.symptomId !== symptomId);
    const nextLinks = frequency === '' ? withoutSymptom : [...withoutSymptom, { symptomId, frequency }];
    onChange({ ...disease, symptomLinks: nextLinks });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={6} c="dimmed">
          <IconGripVertical size={16} />
          <Text size="xs" fw={600} tt="uppercase">
            Заболевание
          </Text>
        </Group>
        <ActionIcon aria-label="Удалить" color="red" variant="subtle" onClick={onRemove} radius="md">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <Grid mb="sm">
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <TextInput
            label="Название"
            placeholder="Например: Периодическая болезнь (FMF)"
            value={disease.name}
            onChange={(e) => onChange({ ...disease, name: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Group gap={4} wrap="nowrap" align="flex-end">
            <NumberInput
              label="Вес до опроса"
              min={0.1}
              step={0.1}
              decimalScale={1}
              value={disease.priorWeight}
              onChange={(v) => onChange({ ...disease, priorWeight: v === '' ? 1 : Number(v) })}
              style={{ flex: 1 }}
            />
            <Tooltip multiline w={240} label="Относительный вес заболевания до первого вопроса. По умолчанию 1 — все заболевания в анкете равновероятны.">
              <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" style={{ marginBottom: 10 }} />
            </Tooltip>
          </Group>
        </Grid.Col>
        <Grid.Col span={12}>
          <Textarea
            label="Описание / чем отличается"
            placeholder="Отличительные признаки, красные флаги, комментарий для дифференциальной диагностики"
            value={disease.description}
            onChange={(e) => onChange({ ...disease, description: e.currentTarget.value })}
            autosize
            minRows={2}
          />
        </Grid.Col>
      </Grid>

      {symptomPool.length > 0 && (
        <>
          <Text size="sm" fw={500} mb={6}>
            Частота симптомов при этом заболевании
          </Text>
          <Grid>
            {symptomPool.map((symptom) => {
              const link = disease.symptomLinks.find((l) => l.symptomId === symptom.id);
              return (
                <Grid.Col key={symptom.id} span={{ base: 12, sm: 6 }}>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                      {symptom.label || 'Без названия'}
                    </Text>
                    <Select
                      size="xs"
                      w={130}
                      data={FREQUENCY_OPTIONS}
                      value={link?.frequency ?? ''}
                      onChange={(v) => setFrequency(symptom.id, (v as SymptomFrequency | '') ?? '')}
                      allowDeselect={false}
                    />
                  </Group>
                </Grid.Col>
              );
            })}
          </Grid>
        </>
      )}
    </Card>
  );
}
