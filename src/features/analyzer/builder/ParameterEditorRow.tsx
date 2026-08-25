import { ActionIcon, Alert, Card, Divider, Grid, Group, NumberInput, Select, Stack, Switch, TagsInput, Text, TextInput } from '@mantine/core';
import { IconGripVertical, IconLock, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import { describeLockedParamRange } from '../customTypes';
import type { CustomAgeBand, CustomLabParameter, CustomLabParameterOption } from '../customTypes';

export interface DraftParameter extends CustomLabParameter {
  uid: string;
}

function emptyAgeBand(): CustomAgeBand {
  return { id: crypto.randomUUID() };
}

interface ParameterEditorRowProps {
  parameter: DraftParameter;
  onChange: (parameter: DraftParameter) => void;
  onRemove: () => void;
  keyError?: string;
}

export function ParameterEditorRow({ parameter, onChange, onRemove, keyError }: ParameterEditorRowProps) {
  const updateOption = (index: number, option: CustomLabParameterOption) => {
    const options = [...(parameter.options ?? [])];
    options[index] = option;
    onChange({ ...parameter, options });
  };

  const addOption = () => {
    const options = [...(parameter.options ?? []), { label: '', value: (parameter.options?.length ?? 0) }];
    onChange({ ...parameter, options });
  };

  const removeOption = (index: number) => {
    const options = (parameter.options ?? []).filter((_, i) => i !== index);
    onChange({ ...parameter, options });
  };

  const byAge = Boolean(parameter.ageBands && parameter.ageBands.length > 0);

  const toggleByAge = (enabled: boolean) => {
    onChange({ ...parameter, ageBands: enabled ? [emptyAgeBand()] : undefined });
  };

  const updateAgeBand = (index: number, band: CustomAgeBand) => {
    const ageBands = [...(parameter.ageBands ?? [])];
    ageBands[index] = band;
    onChange({ ...parameter, ageBands });
  };

  const addAgeBand = () => {
    onChange({ ...parameter, ageBands: [...(parameter.ageBands ?? []), emptyAgeBand()] });
  };

  const removeAgeBand = (index: number) => {
    const ageBands = (parameter.ageBands ?? []).filter((_, i) => i !== index);
    onChange({ ...parameter, ageBands: ageBands.length > 0 ? ageBands : [emptyAgeBand()] });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={6} c="dimmed">
          <IconGripVertical size={16} />
          <Text size="xs" fw={600} tt="uppercase">
            Показатель
          </Text>
        </Group>
        <ActionIcon color="red" variant="subtle" onClick={onRemove} radius="md">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Название показателя"
            placeholder="Например: Кортизол"
            value={parameter.label}
            onChange={(e) => onChange({ ...parameter, label: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Ключ (для правил)"
            placeholder="cortisol"
            value={parameter.key}
            error={keyError}
            onChange={(e) => onChange({ ...parameter, key: e.currentTarget.value })}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TagsInput
            label="Скрытые названия"
            description="Как этот показатель называют в бланках лабораторий. Используются только при загрузке файла анализов и нигде не показываются."
            placeholder="Например: АлАТ"
            value={parameter.aliases ?? []}
            onChange={(aliases) => onChange({ ...parameter, aliases })}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Select
            label="Тип показателя"
            data={
              parameter.inputType === 'derived'
                ? [{ value: 'derived', label: 'Вычисляемый (по формуле)' }]
                : [
                    { value: 'number', label: 'Число' },
                    { value: 'select', label: 'Наличие/отсутствие, список' },
                  ]
            }
            value={parameter.inputType}
            allowDeselect={false}
            disabled={parameter.inputType === 'derived'}
            onChange={(val) =>
              onChange({
                ...parameter,
                inputType: (val as 'number' | 'select') ?? 'number',
                options: val === 'select' ? parameter.options ?? [{ label: 'Не обнаружено', value: 0 }, { label: 'Обнаружено', value: 1 }] : undefined,
              })
            }
          />
        </Grid.Col>

        {(parameter.inputType === 'number' || parameter.inputType === 'derived') && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              label="Единицы измерения"
              placeholder="ммоль/л"
              value={parameter.unit ?? ''}
              onChange={(e) => onChange({ ...parameter, unit: e.currentTarget.value })}
              disabled={parameter.inputType === 'derived'}
            />
          </Grid.Col>
        )}

        {parameter.inputType === 'derived' && (
          <Grid.Col span={12}>
            <Alert variant="light" color="gray" icon={<IconLock size={16} />}>
              <Text size="sm">Формула: {parameter.deriveFormula ?? '—'}</Text>
              {parameter.derivedNote && (
                <Text size="xs" c="dimmed" mt={2}>
                  {parameter.derivedNote}
                </Text>
              )}
              <Text size="xs" c="dimmed" mt={4}>
                Формула вычисляемого показателя не редактируется в конструкторе — значение и заметка сохранятся как есть.
              </Text>
            </Alert>
          </Grid.Col>
        )}

        {(parameter.inputType === 'number' || parameter.inputType === 'derived') && parameter.rangeLocked && (
          <Grid.Col span={12}>
            <Alert variant="light" color="gray" icon={<IconLock size={16} />}>
              <Text size="sm">Норма зависит от пола: {describeLockedParamRange(parameter)}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Такая структура нормы не редактируется в конструкторе — при сохранении останется без изменений.
              </Text>
            </Alert>
          </Grid.Col>
        )}

        {(parameter.inputType === 'number' || parameter.inputType === 'derived') && !parameter.rangeLocked && !byAge && (
          <>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Норма от"
                value={parameter.min ?? ''}
                onChange={(v) => onChange({ ...parameter, min: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Норма до"
                value={parameter.max ?? ''}
                onChange={(v) => onChange({ ...parameter, max: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
          </>
        )}

        {parameter.inputType === 'number' && (
          <>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Шаг"
                value={parameter.step ?? ''}
                onChange={(v) => onChange({ ...parameter, step: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 3 }}>
              <NumberInput
                label="Знаков после запятой"
                min={0}
                max={4}
                value={parameter.decimals ?? ''}
                onChange={(v) => onChange({ ...parameter, decimals: v === '' ? undefined : Number(v) })}
              />
            </Grid.Col>
          </>
        )}

        {(parameter.inputType === 'number' || parameter.inputType === 'derived') && !parameter.rangeLocked && (
          <Grid.Col span={12}>
            <Switch
              label="Норма зависит от возраста"
              description="Задайте несколько возрастных диапазонов вместо одной общей нормы"
              checked={byAge}
              onChange={(e) => toggleByAge(e.currentTarget.checked)}
            />
          </Grid.Col>
        )}

        {(parameter.inputType === 'number' || parameter.inputType === 'derived') && !parameter.rangeLocked && byAge && (
          <Grid.Col span={12}>
            <Divider mb="sm" />
            <Text size="sm" fw={500} mb={6}>
              Возрастные диапазоны нормы
            </Text>
            <Stack gap={6} mb={6}>
              {(parameter.ageBands ?? []).map((band, index) => {
                const isLast = index === (parameter.ageBands?.length ?? 0) - 1;
                return (
                  <Group key={band.id} gap={4} wrap="nowrap" align="flex-end">
                    <NumberInput
                      label="Возраст от"
                      placeholder="0"
                      min={0}
                      max={120}
                      size="sm"
                      style={{ flex: 1, minWidth: 0 }}
                      value={band.minAge ?? ''}
                      onChange={(v) => updateAgeBand(index, { ...band, minAge: v === '' ? undefined : Number(v) })}
                    />
                    <NumberInput
                      label="Возраст до"
                      placeholder="и старше"
                      min={0}
                      max={120}
                      size="sm"
                      style={{ flex: 1, minWidth: 0 }}
                      value={band.maxAge ?? ''}
                      onChange={(v) => updateAgeBand(index, { ...band, maxAge: v === '' ? undefined : Number(v) })}
                    />
                    <NumberInput
                      label="Норма от"
                      size="sm"
                      style={{ flex: 1, minWidth: 0 }}
                      value={band.min ?? ''}
                      onChange={(v) => updateAgeBand(index, { ...band, min: v === '' ? undefined : Number(v) })}
                    />
                    <NumberInput
                      label="Норма до"
                      size="sm"
                      style={{ flex: 1, minWidth: 0 }}
                      value={band.max ?? ''}
                      onChange={(v) => updateAgeBand(index, { ...band, max: v === '' ? undefined : Number(v) })}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => removeAgeBand(index)}
                      disabled={(parameter.ageBands ?? []).length <= 1}
                      style={{ flexShrink: 0 }}
                    >
                      <IconX size={14} />
                    </ActionIcon>
                    {isLast && (
                      <ActionIcon
                        variant="light"
                        color="brand"
                        onClick={addAgeBand}
                        size="lg"
                        radius="md"
                        style={{ flexShrink: 0 }}
                      >
                        <IconPlus size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                );
              })}
            </Stack>
            <Text size="xs" c="dimmed">
              Диапазоны проверяются по порядку сверху вниз; оставьте «Возраст от»/«до» пустыми, чтобы не ограничивать границу. Если возраст пациента не указан, используется диапазон для 30 лет.
            </Text>
          </Grid.Col>
        )}

        {parameter.inputType === 'select' && (
          <Grid.Col span={12}>
            <Text size="sm" fw={500} mb={6}>
              Варианты выбора (значение 0 — норма, любое другое — отклонение)
            </Text>
            <Group gap="xs" align="flex-start" wrap="wrap">
              {(parameter.options ?? []).map((option, index) => (
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

        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Подпись при понижении"
            placeholder="Например: Понижен"
            value={parameter.lowLabel ?? ''}
            onChange={(e) => onChange({ ...parameter, lowLabel: e.currentTarget.value })}
            disabled={parameter.inputType === 'select'}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <TextInput
            label="Подпись при повышении"
            placeholder="Например: Повышен"
            value={parameter.highLabel ?? ''}
            onChange={(e) => onChange({ ...parameter, highLabel: e.currentTarget.value })}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          {/* A nested Grid, not two plain Grid.Col span={6}: the outer Grid's column count so far
           * depends on which conditional fields rendered above (select options, age bands...), so
           * two siblings landed on whichever row had 6 columns left rather than always together.
           * This pair gets its own always-12-wide row with its own independent 6/6 split inside. */}
          <Grid>
            <Grid.Col span={6}>
              <TagsInput
                label="Возможные причины понижения"
                placeholder="Введите причину и нажмите Enter"
                value={parameter.lowCauses}
                onChange={(v) => onChange({ ...parameter, lowCauses: v })}
                disabled={parameter.inputType === 'select'}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TagsInput
                label="Возможные причины повышения"
                placeholder="Введите причину и нажмите Enter"
                value={parameter.highCauses}
                onChange={(v) => onChange({ ...parameter, highCauses: v })}
              />
            </Grid.Col>
          </Grid>
        </Grid.Col>
      </Grid>
    </Card>
  );
}
