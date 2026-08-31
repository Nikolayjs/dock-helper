import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Grid, Group, NumberInput, Select, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconCalculator, IconClipboardPlus, IconPlus } from '@tabler/icons-react';

import { evaluateFormula } from '../../lib/formulaEngine';
import { calculationSummary } from './resultLine';
import type { CalculatorDefinition } from './types';

interface CalculatorFormProps {
  definition: CalculatorDefinition;
  /** When provided, shows a button next to the presets select to add a new preset — omit to hide it (e.g. in the builder preview). */
  onAddPreset?: () => void;
  /**
   * Значения, подставленные из карточки пациента.
   *
   * Кладутся поверх значений по умолчанию **один раз, при монтировании**: страница не рисует форму,
   * пока карточка не пришла, поэтому подставлять их потом не приходится, а если бы приходилось —
   * набранное врачом затиралось бы у него на глазах.
   */
  initialValues?: Record<string, number>;
  /**
   * Поля, которые **должны** были приехать из карточки, но не приехали.
   *
   * Очищаются, а не остаются со значением по умолчанию. Заводские «88 мкмоль/л» у пациента, которому
   * креатинин никто не сдавал, — это клиническое число, взявшееся ниоткуда: калькулятор по нему
   * честно считал клиренс и предлагал записать результат в визит.
   */
  clearedKeys?: string[];
  /** Записать результат в визит. Есть только там, где известен пациент; в предпросмотре конструктора — нет. */
  onSaveResult?: (line: string) => void;
}

function buildInitialValues(
  definition: CalculatorDefinition,
  overrides?: Record<string, number>,
  cleared?: string[],
): Record<string, number | ''> {
  const values: Record<string, number | ''> = {};
  for (const field of definition.fields) {
    values[field.key] = field.defaultValue ?? (field.type === 'select' ? field.options?.[0]?.value ?? '' : '');
  }
  for (const key of cleared ?? []) values[key] = '';
  return { ...values, ...overrides };
}

export function CalculatorForm({ definition, onAddPreset, initialValues, clearedKeys, onSaveResult }: CalculatorFormProps) {
  const [values, setValues] = useState<Record<string, number | ''>>(() => buildInitialValues(definition, initialValues, clearedKeys));
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

  /**
   * Цвет плашки — цвет толкования, а не калькулятора.
   *
   * У результата без толкования (у половины калькуляторов его нет) цвета быть не должно вовсе:
   * «серый» здесь честнее фирменного, который означал бы что-то там, где означать нечего.
   */
  const accent = matchedRange?.color ?? 'gray';

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

      {/*
        Плашка результата — ступень под карточкой, а не заливка фирменным цветом.

        Заливка `brand-light` во всю ширину читалась как чужая плита: под обоями она вдобавок
        спорила с их цветом, а сам цвет ничего не значил — он одинаков и у нормы, и у ожирения.
        Теперь поверхность нейтральная (`--app-stripe-bg` — та же ступень, что у чередующихся строк
        таблицы и наведения), а цвет достался тому, что его заслуживает: **полосе слева и значку по
        толкованию результата**. Ровно так же устроены карточки заключений анализатора.
      */}
      <Card
        withBorder
        padding="lg"
        style={{
          backgroundColor: 'var(--app-stripe-bg)',
          borderLeft: `3px solid var(--mantine-color-${accent}-6)`,
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Group gap="sm" align="flex-start">
            <ThemeIcon size={38} radius="md" variant="light" color={accent}>
              <IconCalculator size={20} />
            </ThemeIcon>
            <div>
              <Text size="sm" c="dimmed" fw={500}>
                {definition.resultLabel}
              </Text>
              <Group gap={6} align="baseline">
                {/* Число набрано обычным цветом текста: оно и так самое крупное на плашке, а
                    цветом здесь говорит толкование — значок, полоса и значок-подпись справа. */}
                <Text size="2rem" fw={700}>
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
          <Group gap="xs" align="center" wrap="nowrap">
            {matchedRange && (
              <Badge color={matchedRange.color} variant="light" size="lg" radius="sm">
                {matchedRange.label}
              </Badge>
            )}
          </Group>
        </Group>

        {/* Что число значит и меняет ли оно что-нибудь.
            Без этой строки плашка сообщала только цифру и ярлык — «Умеренная депрессия, 12», — а
            цифру врач и так видит. Стоит под результатом, а не в подсказке: читать её нужно вместе
            с числом, а не наводя на что-то мышь. */}
        {matchedRange?.note && !error && result !== null && (
          <Text size="sm" c="dimmed" mt="sm">
            {matchedRange.note}
          </Text>
        )}

        {/* Записать можно только посчитанное: кнопка при пустом результате обещала бы то, чего нет. */}
        {onSaveResult && result !== null && !error && (
          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              leftSection={<IconClipboardPlus size={16} />}
              onClick={() => onSaveResult(calculationSummary(definition, values, result, matchedRange))}
            >
              Записать в визит
            </Button>
          </Group>
        )}
      </Card>
    </Stack>
  );
}
