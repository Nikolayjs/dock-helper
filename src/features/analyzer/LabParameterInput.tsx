import { memo } from 'react';
import { Badge, Grid, Group, NumberInput, Select, Text } from '@mantine/core';

import { getParamRange } from './types';
import type { LabParameter, ParamStatus, Sex } from './types';

interface LabParameterInputProps {
  param: LabParameter;
  sex: Sex;
  age: number | undefined;
  value: number | undefined;
  status: ParamStatus | undefined;
  /**
   * Ключ передаётся обратно, чтобы обработчик был **один на всю форму**.
   *
   * Со стрелкой на каждую строку (`(v) => onChange(param.key, v)`) у каждого поля на каждый набор
   * появлялся новый пропс, и мемоизация не работала бы вовсе: одна набранная цифра перерисовывала
   * все тридцать полей анализа.
   */
  onChange: (key: string, value: number | undefined) => void;
}

function formatRange(param: LabParameter, sex: Sex, age: number | undefined): string | null {
  if (param.inputType === 'select') return null;
  const range = getParamRange(param, sex, age);
  const unit = param.unit ? ` ${param.unit}` : '';
  if (range.min !== undefined && range.max !== undefined) return `Норма: ${range.min}–${range.max}${unit}`;
  if (range.max !== undefined) return `Норма: до ${range.max}${unit}`;
  if (range.min !== undefined) return `Норма: от ${range.min}${unit}`;
  return null;
}

function LabParameterInputView({ param, sex, age, value, status, onChange }: LabParameterInputProps) {
  const rangeText = formatRange(param, sex, age);
  const statusColor = status === 'high' ? 'red' : status === 'low' ? 'blue' : undefined;
  const statusLabel =
    param.inputType === 'select' ? undefined : status === 'high' ? 'Выше нормы' : status === 'low' ? 'Ниже нормы' : undefined;

  const label = (
    <Group justify="space-between" gap={6}>
      <Text size="sm" fw={500}>
        {param.label}
      </Text>
      {statusLabel && (
        <Badge size="xs" color={statusColor} variant="light" radius="sm">
          {statusLabel}
        </Badge>
      )}
    </Group>
  );

  const borderStyle = statusColor ? { input: { borderColor: `var(--mantine-color-${statusColor}-5)` } } : undefined;

  if (param.inputType === 'select') {
    return (
      <Select
        label={label}
        placeholder="Не указано"
        data={param.options?.map((o) => ({ label: o.label, value: String(o.value) })) ?? []}
        value={value === undefined ? null : String(value)}
        onChange={(v) => onChange(param.key, v === null ? undefined : Number(v))}
        radius="md"
        styles={borderStyle}
      />
    );
  }

  if (param.inputType === 'derived') {
    return (
      <NumberInput
        label={label}
        description={rangeText}
        placeholder={param.derivedNote ?? 'Заполните исходные показатели'}
        suffix={param.unit ? ` ${param.unit}` : undefined}
        decimalScale={param.decimals}
        value={value ?? ''}
        disabled
        radius="md"
        styles={borderStyle}
      />
    );
  }

  return (
    <NumberInput
      label={label}
      description={rangeText}
      placeholder="Не указано"
      suffix={param.unit ? ` ${param.unit}` : undefined}
      decimalScale={param.decimals}
      step={param.step ?? 1}
      value={value ?? ''}
      onChange={(v) => onChange(param.key, v === '' ? undefined : Number(v))}
      radius="md"
      styles={borderStyle}
    />
  );
}

/** Колонка сетки живёт здесь, внутри мемоизации: снаружи она перерисовывалась бы на каждую цифру. */
function LabParameterCell(props: LabParameterInputProps) {
  return (
    <Grid.Col span={{ base: 12, sm: 6 }}>
      <LabParameterInputView {...props} />
    </Grid.Col>
  );
}

/**
 * Поле мемоизировано, и это не микрооптимизация.
 *
 * В анализе бывает три десятка показателей, а набранная цифра меняет значение ровно у одного из
 * них — и статус ещё у нескольких производных. Без `memo` каждое нажатие перерисовывало все поля
 * разом; в конструкторе, где рядом ещё три десятка карточек редактора, это и было теми «ужасными
 * фризами», на которые пожаловался врач.
 */
export const LabParameterInput = memo(LabParameterCell);
