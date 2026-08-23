import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Card, Grid, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { IconCalculator, IconPlus } from '@tabler/icons-react';

import { evaluateFormula } from '../../lib/formulaEngine';
import type { CalculatorDefinition } from './types';

interface CalculatorFormProps {
  definition: CalculatorDefinition;
  /** When provided, shows a button next to the presets select to add a new preset — omit to hide it (e.g. in the builder preview). */
  onAddPreset?: () => void;
}

function buildInitialValues(definition: CalculatorDefinition): Record<string, number | ''> {
  const values: Record<string, number | ''> = {};
  for (const field of definition.fields) {
    values[field.key] = field.defaultValue ?? (field.type === 'select' ? field.options?.[0]?.value ?? '' : '');
  }
  return values;
}

export function CalculatorForm({ definition, onAddPreset }: CalculatorFormProps) {
  const [values, setValues] = useState<Record<string, number | ''>>(() => buildInitialValues(definition));
  const [presetId, setPresetId] = useState<string | null>(null);

  const applyPreset = (id: string | null) => {
    setPresetId(id);
    const preset = definition.presets?.find((p) => p.id === id);
    if (!preset) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const { fieldKey, value } of preset.values) next[fieldKey] = value;
      return next;
    });
  };

  const { result, error } = useMemo(() => {
    const hasAllValues = definition.fields.every((field) => values[field.key] !== '' && values[field.key] !== undefined);
    if (!hasAllValues) return { result: null, error: null };

    try {
      const numericValues = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, Number(value)]),
      );
      const raw = evaluateFormula(definition.formula, numericValues);
      if (!Number.isFinite(raw)) return { result: null, error: 'Проверьте введённые значения' };
      return { result: raw, error: null };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Ошибка вычисления' };
    }
  }, [values, definition]);

  const matchedRange = useMemo(() => {
    if (result === null || !definition.interpretation) return undefined;
    return definition.interpretation.find((range) => {
      const aboveMin = range.min === undefined || result >= range.min;
      const belowMax = range.max === undefined || result < range.max;
      return aboveMin && belowMax;
    });
  }, [result, definition.interpretation]);

  return (
    <Stack gap="lg">
      {(onAddPreset || (definition.presets && definition.presets.length > 0)) && (
        <Group align="flex-end" gap="xs" wrap="nowrap">
          <Select
            style={{ flex: 1 }}
            label={definition.presetsLabel || 'Быстрый выбор'}
            placeholder={definition.presets?.length ? 'Не выбрано' : 'Пресетов пока нет'}
            data={definition.presets?.map((preset) => ({ label: preset.label, value: preset.id })) ?? []}
            value={presetId}
            onChange={applyPreset}
            disabled={!definition.presets?.length}
            clearable
            radius="md"
          />
          {onAddPreset && (
            <ActionIcon variant="light" color="brand" size="lg" radius="md" onClick={onAddPreset} aria-label="Добавить пресет" style={{ flexShrink: 0 }}>
              <IconPlus size={18} />
            </ActionIcon>
          )}
        </Group>
      )}

      <Grid>
        {definition.fields.map((field) => (
          <Grid.Col key={field.key} span={{ base: 12, sm: 6 }}>
            {field.type === 'number' ? (
              <NumberInput
                label={field.label}
                suffix={field.unit ? ` ${field.unit}` : undefined}
                min={field.min}
                max={field.max}
                step={field.step ?? 1}
                value={values[field.key]}
                onChange={(val) => setValues((prev) => ({ ...prev, [field.key]: val === '' ? '' : Number(val) }))}
                radius="md"
                hideControls={false}
              />
            ) : (
              <Select
                label={field.label}
                data={field.options?.map((option) => ({ label: option.label, value: String(option.value) })) ?? []}
                value={values[field.key] === '' ? null : String(values[field.key])}
                onChange={(val) => setValues((prev) => ({ ...prev, [field.key]: val === null ? '' : Number(val) }))}
                radius="md"
                allowDeselect={false}
              />
            )}
          </Grid.Col>
        ))}
      </Grid>

      <Card
        withBorder
        padding="lg"
        style={{
          backgroundColor: 'var(--mantine-color-brand-light)',
          borderColor: 'var(--mantine-color-brand-light-hover)',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" align="flex-start">
            <Card
              padding={10}
              radius="md"
              withBorder
              style={{
                backgroundColor: 'var(--mantine-color-body)',
                borderColor: 'var(--mantine-color-brand-light-hover)',
              }}
            >
              <IconCalculator size={20} color="var(--mantine-color-brand-6)" />
            </Card>
            <div>
              <Text size="sm" c="dimmed" fw={500}>
                {definition.resultLabel}
              </Text>
              <Group gap={6} align="baseline">
                <Text size="2rem" fw={700} style={{ color: 'var(--mantine-color-brand-light-color)' }}>
                  {error ? '—' : result !== null ? result.toFixed(definition.decimals) : '—'}
                </Text>
                {definition.resultUnit && !error && result !== null && (
                  <Text size="sm" c="dimmed">
                    {definition.resultUnit}
                  </Text>
                )}
              </Group>
              {error && (
                <Text size="xs" c="red">
                  {error}
                </Text>
              )}
            </div>
          </Group>
          {matchedRange && (
            <Badge color={matchedRange.color} variant="light" size="lg" radius="sm">
              {matchedRange.label}
            </Badge>
          )}
        </Group>
      </Card>
    </Stack>
  );
}
