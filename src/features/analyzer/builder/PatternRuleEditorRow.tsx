import { ActionIcon, Alert, Card, Grid, Group, Select, SegmentedControl, Stack, Switch, TagsInput, Text, TextInput } from '@mantine/core';
import { IconGripVertical, IconLock, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import type { ParamStatus, Severity, Sex } from '../types';
import type { CustomPatternRule, PatternCondition } from '../customTypes';

export interface DraftPatternRule extends CustomPatternRule {
  uid: string;
}

interface ParamOption {
  key: string;
  label: string;
}

interface PatternRuleEditorRowProps {
  rule: DraftPatternRule;
  paramOptions: ParamOption[];
  /** Precomputed human-readable summary of `rule.rawRoot`, shown instead of the condition editor when `rule.locked`. */
  lockedSummary?: string;
  onChange: (rule: DraftPatternRule) => void;
  onRemove: () => void;
}

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Информация' },
  { value: 'warning', label: 'Внимание' },
  { value: 'critical', label: 'Критично' },
];

const STATUS_OPTIONS = [
  { value: 'low', label: 'Понижен' },
  { value: 'normal', label: 'В норме' },
  { value: 'high', label: 'Повышен' },
];

const SEX_OPTIONS = [
  { value: 'female', label: 'Женский' },
  { value: 'male', label: 'Мужской' },
];

/**
 * Значение первого списка, означающее «условие про пациента, а не про показатель».
 *
 * Живёт только в этом списке: в правило уходит отдельный вид условия, а не показатель с особым
 * ключом. Совпадение с настоящим ключом поэтому ничего не ломает — сравнивается вид условия.
 */
const SEX_ITEM = '__patient-sex__';

function emptyCondition(paramOptions: ParamOption[]): PatternCondition {
  return { id: crypto.randomUUID(), kind: 'param', paramKey: paramOptions[0]?.key ?? '', status: 'high' };
}

/**
 * Смена того, о чём условие: показатель <-> пол пациента.
 *
 * Вид условия меняется целиком, а не подменой одного поля: у условия про пол нет ни показателя, ни
 * статуса, и оставлять их «на всякий случай» значило бы хранить рядом с правилом данные, которых в
 * нём нет. Отрицание переносится — оно про само условие, а не про его предмет.
 */
function switchSubject(condition: PatternCondition, value: string | null): PatternCondition {
  if (value === SEX_ITEM) {
    return condition.kind === 'sex' ? condition : { id: condition.id, kind: 'sex', sex: 'female', negate: condition.negate };
  }
  if (value === null) return condition;
  return condition.kind === 'param'
    ? { ...condition, paramKey: value }
    : { id: condition.id, kind: 'param', paramKey: value, status: 'high', negate: condition.negate };
}

export function PatternRuleEditorRow({ rule, paramOptions, lockedSummary, onChange, onRemove }: PatternRuleEditorRowProps) {
  const updateCondition = (index: number, condition: PatternCondition) => {
    const conditions = [...rule.conditions];
    conditions[index] = condition;
    onChange({ ...rule, conditions });
  };

  const addCondition = () => {
    onChange({ ...rule, conditions: [...rule.conditions, emptyCondition(paramOptions)] });
  };

  const removeCondition = (index: number) => {
    onChange({ ...rule, conditions: rule.conditions.filter((_, i) => i !== index) });
  };

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={6} c="dimmed">
          <IconGripVertical size={16} />
          <Text size="xs" fw={600} tt="uppercase">
            Правило
          </Text>
        </Group>
        <ActionIcon color="red" variant="subtle" onClick={onRemove} radius="md">
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <TextInput
            label="Заключение"
            placeholder="Например: Картина, характерная для гипотиреоза"
            value={rule.title}
            onChange={(e) => onChange({ ...rule, title: e.currentTarget.value })}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Select
            label="Важность"
            data={SEVERITY_OPTIONS}
            value={rule.severity}
            allowDeselect={false}
            onChange={(v) => onChange({ ...rule, severity: (v as Severity) ?? 'info' })}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          <TagsInput
            label="Возможные причины"
            placeholder="Введите причину и нажмите Enter"
            value={rule.causes}
            onChange={(v) => onChange({ ...rule, causes: v })}
          />
        </Grid.Col>

        <Grid.Col span={12}>
          {rule.locked ? (
            <Alert variant="light" color="gray" icon={<IconLock size={16} />}>
              <Text size="sm">Условия срабатывания: {lockedSummary ?? '—'}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Такая структура условий не редактируется в конструкторе — при сохранении останется без изменений.
              </Text>
            </Alert>
          ) : (
            <>
              <Group justify="space-between" align="center" mb={6}>
                <Text size="sm" fw={500}>
                  Условия срабатывания
                </Text>
                <SegmentedControl
                  size="xs"
                  value={rule.operator}
                  onChange={(v) => onChange({ ...rule, operator: v as 'and' | 'or' })}
                  data={[
                    { value: 'and', label: 'Все условия' },
                    { value: 'or', label: 'Любое условие' },
                  ]}
                />
              </Group>

              <Stack gap="xs">
                {rule.conditions.map((condition, index) => (
                  <Group key={condition.id} gap={6} wrap="nowrap" align="center">
                    <Select
                      style={{ flex: 1 }}
                      size="sm"
                      data={[
                        { group: 'Пациент', items: [{ value: SEX_ITEM, label: 'Пол пациента' }] },
                        {
                          group: 'Показатели',
                          items: paramOptions.map((p) => ({ value: p.key, label: p.label || p.key })),
                        },
                      ]}
                      value={condition.kind === 'sex' ? SEX_ITEM : condition.paramKey}
                      onChange={(v) => updateCondition(index, switchSubject(condition, v))}
                      placeholder="Показатель"
                    />
                    {condition.kind === 'sex' ? (
                      <Select
                        size="sm"
                        w={150}
                        data={SEX_OPTIONS}
                        value={condition.sex}
                        allowDeselect={false}
                        onChange={(v) => updateCondition(index, { ...condition, sex: (v as Sex) ?? 'female' })}
                      />
                    ) : (
                      <Select
                        size="sm"
                        w={150}
                        data={STATUS_OPTIONS}
                        value={condition.status}
                        allowDeselect={false}
                        onChange={(v) => updateCondition(index, { ...condition, status: (v as ParamStatus) ?? 'high' })}
                      />
                    )}
                    <Switch
                      size="sm"
                      label="не"
                      title={
                        condition.kind === 'sex'
                          ? 'Условие срабатывает, когда пол пациента ДРУГОЙ'
                          : 'Условие срабатывает, когда показатель НЕ в этом статусе'
                      }
                      checked={condition.negate ?? false}
                      onChange={(e) => updateCondition(index, { ...condition, negate: e.currentTarget.checked })}
                    />
                    <ActionIcon variant="subtle" color="red" onClick={() => removeCondition(index)}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                ))}
                <ActionIcon
                  variant="light"
                  color="brand"
                  onClick={addCondition}
                  size="lg"
                  radius="md"
                  disabled={paramOptions.length === 0}
                  aria-label="Добавить условие"
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Stack>
            </>
          )}
        </Grid.Col>
      </Grid>
    </Card>
  );
}
