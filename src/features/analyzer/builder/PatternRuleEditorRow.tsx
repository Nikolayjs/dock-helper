import { memo } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Alert, Button, Grid, Group, MultiSelect, NumberInput, Select, SegmentedControl, Stack, TagsInput, Text, TextInput } from '@mantine/core';
import { IconLock, IconPlus, IconX } from '@tabler/icons-react';

import { CollapsibleRow } from './CollapsibleRow';
import { incomplete } from './conditions';

import type { ParamStatus, Severity, Sex } from '../types';
import type { CompareOp, CustomPatternRule, PatternCondition } from '../customTypes';

export interface DraftPatternRule extends CustomPatternRule {
  uid: string;
}

interface ParamOption {
  key: string;
  label: string;
  /** Показывается рядом с числом: без неё врач введёт 15 там, где шкала в 10⁹/л, и не узнает об этом. */
  unit?: string;
}

interface PatternRuleEditorRowProps {
  rule: DraftPatternRule;
  paramOptions: ParamOption[];
  /** Precomputed human-readable summary of `rule.rawRoot`, shown instead of the condition editor when `rule.locked`. */
  lockedSummary?: string;
  onChange: (rule: DraftPatternRule) => void;
  /** Принимает `uid`, чтобы обработчик был один на все строки — иначе мемоизация не работает. */
  onRemove: (uid: string) => void;
  open: boolean;
  /** Принимает `uid` по той же причине, что и `onRemove`. */
  onToggle: (uid: string) => void;
}

const SEVERITY_OPTIONS = [
  { value: 'info', label: 'Информация' },
  { value: 'warning', label: 'Внимание' },
  { value: 'critical', label: 'Критично' },
];

/**
 * Состояние показателя и отрицание — **одним** списком, а не списком и тумблером рядом.
 *
 * Тумблер, подписанный одним словом «не», не говорит ни к чему он относится, ни что значит нажатый:
 * рядом с ним стоят два безымянных списка, и строка условия читалась как три случайных поля.
 * Одним списком она читается фразой — «гемоглобин: не повышен», — а состояний ровно шесть, и все
 * шесть видны сразу, вместо того чтобы складываться в голове из положения переключателя.
 */
const STATUS_OPTIONS = [
  { value: 'low', label: 'Понижен' },
  { value: 'normal', label: 'В норме' },
  { value: 'high', label: 'Повышен' },
];

/**
 * Отрицание — отдельным списком из двух значений, а не приставкой к каждому статусу.
 *
 * Раньше состояние и отрицание были одним списком из шести значений («Понижен», «Не понижен»…), и
 * это читалось фразой. С набором состояний так не выходит: «повышен или норма» и «не (повышен или
 * норма)» — про набор целиком, а шесть значений превратились бы в перебор всех сочетаний. Два
 * слова рядом с набором читаются так же ясно и не растут.
 */
const MATCH_OPTIONS = [
  { value: 'is', label: 'Одно из' },
  { value: 'not', label: 'Ни одно из' },
];

const OP_OPTIONS: { value: CompareOp; label: string }[] = [
  { value: 'gte', label: '≥ не меньше' },
  { value: 'gt', label: '> больше' },
  { value: 'lte', label: '≤ не больше' },
  { value: 'lt', label: '< меньше' },
];

/** Знак оператора для свёрнутой строки: в подписи он читается лучше слова. */
const OP_SIGN: Record<CompareOp, string> = { gte: '≥', gt: '>', lte: '≤', lt: '<' };

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

/** «Возраст пациента» в том же списке — по той же причине, что и пол. */
const AGE_ITEM = '__patient-age__';

/**
 * Что проверяет условие о показателе: состояние или число.
 *
 * Два вида, а не поле «число» рядом со статусом: у условия о числе нет статуса, а у условия о
 * статусе нет ни оператора, ни величины, и держать их рядом «на всякий случай» значило бы хранить
 * в правиле данные, которых в нём нет.
 */
const SUBJECT_OPTIONS = [
  { value: 'status', label: 'состояние' },
  { value: 'value', label: 'значение' },
];

/**
 * Условия правила одной фразой — для свёрнутой строки.
 *
 * У правила, пришедшего из сида со сложной структурой (`locked`), уже есть готовое описание: его
 * считает страница той же функцией, которой рисует замок внутри. Здесь описываются только те
 * условия, что редактируются в конструкторе.
 */
function summarizeConditions(rule: DraftPatternRule, paramOptions: ParamOption[], lockedSummary?: string): string {
  if (rule.locked) return lockedSummary ?? 'условия не редактируются';
  const label = (key: string) => paramOptions.find((p) => p.key === key)?.label || key;
  const STATUS: Record<string, string> = { low: 'понижен', normal: 'в норме', high: 'повышен' };
  const parts = rule.conditions.map((c) => {
    if (c.kind === 'sex') return `${c.negate ? 'не ' : ''}${c.sex === 'male' ? 'мужчина' : 'женщина'}`;
    if (c.kind === 'age') return `возраст ${c.negate ? 'не ' : ''}${OP_SIGN[c.op]} ${c.value ?? '?'}`;
    if (c.kind === 'value') return `${label(c.paramKey)} ${c.negate ? 'не ' : ''}${OP_SIGN[c.op]} ${c.value ?? '?'}`;
    const states = c.statuses.map((status) => STATUS[status] ?? status).join(' или ');
    return `${label(c.paramKey)} ${c.negate ? 'не ' : ''}${states || '?'}`;
  });
  if (parts.length === 0) return 'условий нет';
  return parts.join(rule.operator === 'or' ? ' или ' : ' и ');
}

function emptyCondition(paramOptions: ParamOption[]): PatternCondition {
  return { id: crypto.randomUUID(), kind: 'param', paramKey: paramOptions[0]?.key ?? '', statuses: ['high'] };
}

/**
 * Смена того, о чём условие: показатель <-> пол пациента.
 *
 * Вид условия меняется целиком, а не подменой одного поля: у условия про пол нет ни показателя, ни
 * статуса, и оставлять их «на всякий случай» значило бы хранить рядом с правилом данные, которых в
 * нём нет. Отрицание переносится — оно про само условие, а не про его предмет.
 */
function switchSubject(condition: PatternCondition, value: string | null): PatternCondition {
  if (value === null) return condition;
  if (value === SEX_ITEM) {
    return condition.kind === 'sex' ? condition : { id: condition.id, kind: 'sex', sex: 'female', negate: condition.negate };
  }
  if (value === AGE_ITEM) {
    return condition.kind === 'age' ? condition : { id: condition.id, kind: 'age', op: 'gte', negate: condition.negate };
  }
  // Показатель сменился, а вид условия — нет: врач менял предмет, а не вопрос о нём.
  if (condition.kind === 'value' || condition.kind === 'param') return { ...condition, paramKey: value };
  return { id: condition.id, kind: 'param', paramKey: value, statuses: ['high'], negate: condition.negate };
}

/** Переключение «состояние ↔ значение» у условия о показателе. Вид меняется целиком. */
function switchParamMode(condition: PatternCondition, mode: string | null): PatternCondition {
  if (mode === 'value' && condition.kind === 'param') {
    return { id: condition.id, kind: 'value', paramKey: condition.paramKey, op: 'gte', negate: condition.negate };
  }
  if (mode === 'status' && condition.kind === 'value') {
    return { id: condition.id, kind: 'param', paramKey: condition.paramKey, statuses: ['high'], negate: condition.negate };
  }
  return condition;
}

function PatternRuleEditorRowView({ rule, paramOptions, lockedSummary, onChange, onRemove, open, onToggle }: PatternRuleEditorRowProps) {
  /*
   * На узком экране подписи повторяются у каждого условия, и это не многословие.
   * Там списки не помещаются в строку и встают друг под друга — то есть пять одинаковых
   * коробок подряд, из которых не видно, где кончается одно условие и начинается следующее.
   * На широком они стоят колонками, и одной шапки хватает.
   */
  const narrow = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });
  const labelled = (index: number) => narrow || index === 0;
  const unitOf = (key: string) => paramOptions.find((option) => option.key === key)?.unit?.trim() || undefined;
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
    <CollapsibleRow
      kind="Правило"
      title={rule.title}
      summary={summarizeConditions(rule, paramOptions, lockedSummary)}
      open={open}
      onToggle={() => onToggle(rule.uid)}
      onRemove={() => onRemove(rule.uid)}
      invalid={!rule.title.trim() || (!rule.locked && (rule.conditions.length === 0 || rule.conditions.some(incomplete)))}
    >
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
                  /*
                   * Ширины заданы долями, а не «остаток и 150 px»: на широком экране первый список
                   * растягивался во весь ряд, а состояние оставалось узкой коробкой у самого края.
                   * Подписи — по правилу `labelled`: шапка над первым условием, а на узком экране,
                   * где списки встают друг под друга, у каждого своя.
                   */
                  <Group key={condition.id} gap={6} wrap="wrap" align="flex-end">
                    <Select
                      style={{ flex: '3 1 190px', minWidth: 0 }}
                      size="sm"
                      label={labelled(index) ? 'Что проверяем' : undefined}
                      aria-label="Показатель или признак пациента"
                      data={[
                        {
                          group: 'Пациент',
                          items: [
                            { value: SEX_ITEM, label: 'Пол пациента' },
                            { value: AGE_ITEM, label: 'Возраст пациента' },
                          ],
                        },
                        {
                          group: 'Показатели',
                          items: paramOptions.map((p) => ({ value: p.key, label: p.label || p.key })),
                        },
                      ]}
                      value={condition.kind === 'sex' ? SEX_ITEM : condition.kind === 'age' ? AGE_ITEM : condition.paramKey}
                      onChange={(v) => updateCondition(index, switchSubject(condition, v))}
                      placeholder="Показатель"
                    />

                    {condition.kind === 'sex' && (
                      <Select
                        size="sm"
                        style={{ flex: '2 1 150px', minWidth: 0 }}
                        label={labelled(index) ? 'Пол пациента' : undefined}
                        aria-label="Пол пациента"
                        data={SEX_OPTIONS}
                        /*
                         * Пол известен всегда и бывает двух видов, поэтому «не женский» — это в
                         * точности «мужской»: отрицание здесь ничего не добавляет, и правило из
                         * сида, записанное через него, показывается и сохраняется прямо.
                         */
                        value={condition.negate ? (condition.sex === 'male' ? 'female' : 'male') : condition.sex}
                        allowDeselect={false}
                        onChange={(v) => updateCondition(index, { ...condition, sex: (v as Sex) ?? 'female', negate: undefined })}
                      />
                    )}

                    {(condition.kind === 'param' || condition.kind === 'value') && (
                      <Select
                        size="sm"
                        style={{ flex: '0 1 130px', minWidth: 0 }}
                        label={labelled(index) ? 'Проверяем' : undefined}
                        aria-label="Состояние или значение показателя"
                        data={SUBJECT_OPTIONS}
                        value={condition.kind === 'value' ? 'value' : 'status'}
                        allowDeselect={false}
                        onChange={(v) => updateCondition(index, switchParamMode(condition, v))}
                      />
                    )}

                    {condition.kind === 'param' && (
                      <>
                        <Select
                          size="sm"
                          style={{ flex: '0 1 130px', minWidth: 0 }}
                          label={labelled(index) ? 'Совпадение' : undefined}
                          aria-label="Совпадение состояния"
                          data={MATCH_OPTIONS}
                          value={condition.negate ? 'not' : 'is'}
                          allowDeselect={false}
                          onChange={(v) => updateCondition(index, { ...condition, negate: v === 'not' || undefined })}
                        />
                        <MultiSelect
                          size="sm"
                          style={{ flex: '2 1 190px', minWidth: 0 }}
                          label={labelled(index) ? 'В каком состоянии' : undefined}
                          aria-label="Состояния показателя"
                          data={STATUS_OPTIONS}
                          value={condition.statuses}
                          /* Пустой набор — это условие, которое не про что: строка помечается
                             незаполненной, и правило не сохраняется, пока в нём что-то не выбрано. */
                          onChange={(v) => updateCondition(index, { ...condition, statuses: v as ParamStatus[] })}
                          placeholder={condition.statuses.length === 0 ? 'Выберите' : undefined}
                          hidePickedOptions
                          comboboxProps={{ withinPortal: true }}
                        />
                      </>
                    )}

                    {(condition.kind === 'value' || condition.kind === 'age') && (
                      <>
                        <Select
                          size="sm"
                          style={{ flex: '0 1 150px', minWidth: 0 }}
                          label={labelled(index) ? 'Сравнение' : undefined}
                          aria-label="Оператор сравнения"
                          data={OP_OPTIONS}
                          value={condition.op}
                          allowDeselect={false}
                          onChange={(v) => updateCondition(index, { ...condition, op: (v as CompareOp) ?? 'gte' })}
                        />
                        <NumberInput
                          size="sm"
                          style={{ flex: '1 1 130px', minWidth: 0 }}
                          label={labelled(index) ? (condition.kind === 'age' ? 'Лет' : 'Значение') : undefined}
                          aria-label={condition.kind === 'age' ? 'Возраст в годах' : 'Значение показателя'}
                          value={condition.value ?? ''}
                          onChange={(v) => {
                            const next = typeof v === 'number' ? v : Number(v);
                            updateCondition(index, { ...condition, value: Number.isFinite(next) ? next : undefined });
                          }}
                          /* Единица измерения стоит прямо в поле: без неё врач введёт 15 там, где
                             шкала в 10⁹/л, и не узнает об этом — число примут молча. */
                          rightSection={
                            condition.kind === 'age' ? (
                              <Text size="xs" c="dimmed" pr={6}>
                                лет
                              </Text>
                            ) : unitOf(condition.paramKey) ? (
                              <Text size="xs" c="dimmed" pr={6} style={{ whiteSpace: 'nowrap' }}>
                                {unitOf(condition.paramKey)}
                              </Text>
                            ) : null
                          }
                          rightSectionWidth={condition.kind === 'age' ? 34 : Math.min(72, 12 + (unitOf(condition.paramKey)?.length ?? 0) * 7)}
                          hideControls
                        />
                        <Select
                          size="sm"
                          style={{ flex: '0 1 120px', minWidth: 0 }}
                          label={labelled(index) ? 'Совпадение' : undefined}
                          aria-label="Совпадение сравнения"
                          data={MATCH_OPTIONS}
                          value={condition.negate ? 'not' : 'is'}
                          allowDeselect={false}
                          onChange={(v) => updateCondition(index, { ...condition, negate: v === 'not' || undefined })}
                        />
                      </>
                    )}

                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="lg"
                      style={{ flexShrink: 0 }}
                      onClick={() => removeCondition(index)}
                      aria-label="Удалить условие"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ))}
                {/* Кнопка названа словами, как «Добавить правило» выше: значок «+» без подписи в
                    списке из двух строк не объясняет, что именно он добавит. */}
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={addCondition}
                  disabled={paramOptions.length === 0}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Добавить условие
                </Button>
              </Stack>
            </>
          )}
        </Grid.Col>
      </Grid>
    </CollapsibleRow>
  );
}

/**
 * Строка мемоизирована: в анализе бывает три десятка показателей, и каждая строка — это два десятка
 * полей Mantine. Без этого любая правка **где угодно на странице** (в том числе цифра, набранная в
 * предпросмотре справа) перерисовывала все шестьсот полей разом. Условие мемоизации — постоянные
 * обработчики: они объявлены один раз на всю страницу, а строка называет себя сама (`uid`).
 */
export const PatternRuleEditorRow = memo(PatternRuleEditorRowView);
