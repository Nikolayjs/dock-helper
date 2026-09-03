import { memo, useState } from 'react';
import { ActionIcon, Alert, Button, Divider, Grid, Group, NumberInput, Select, Stack, Switch, Tabs, TagsInput, Text, TextInput } from '@mantine/core';
import { IconLock, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import { ageBandWarnings } from './ageBands';
import { CollapsibleRow } from './CollapsibleRow';

import type { CustomAgeBand, CustomLabParameter, CustomLabParameterOption, CustomRange } from '../customTypes';

export interface DraftParameter extends CustomLabParameter {
  uid: string;
}

/** Строка, у которой норма может быть разделена по полу: сам показатель и любой его диапазон. */
type SexedRow = CustomRange & { male?: CustomRange; female?: CustomRange };

/** Порядок один во всех местах: мужчины первыми, как в самой норме (`SexRange`). */
const SEXES = [
  { field: 'male', title: 'Мужчины' },
  { field: 'female', title: 'Женщины' },
] as const;

function emptyAgeBand(): CustomAgeBand {
  return { id: crypto.randomUUID() };
}

/** Пара полей «от/до» — одна и та же и для общей нормы, и для мужской, и для женской. */
function RangePair({
  range,
  onChange,
  labels,
  size,
  suffix,
}: {
  range: CustomRange | undefined;
  onChange: (range: CustomRange) => void;
  /** Подписи показываются только у первой строки: под ней поля стоят столбиком и подписаны ею же. */
  labels: boolean;
  size?: 'sm';
  /** Для голоса диктора, когда подписи скрыты: «Норма от, мужчины». */
  suffix: string;
}) {
  return (
    <>
      <NumberInput
        label={labels ? 'Норма от' : undefined}
        aria-label={`Норма от, ${suffix}`}
        size={size}
        style={{ flex: 1, minWidth: 0 }}
        value={range?.min ?? ''}
        onChange={(v) => onChange({ ...range, min: v === '' ? undefined : Number(v) })}
      />
      <NumberInput
        label={labels ? 'Норма до' : undefined}
        aria-label={`Норма до, ${suffix}`}
        size={size}
        style={{ flex: 1, minWidth: 0 }}
        value={range?.max ?? ''}
        onChange={(v) => onChange({ ...range, max: v === '' ? undefined : Number(v) })}
      />
    </>
  );
}

/**
 * Подпись вкладки диапазона: то, чем он отличается от соседних, — его границы.
 *
 * **Обе границы включающие**, и подпись это говорит вслух: «до 14 включительно», а не «до 14», —
 * иначе врач не может знать, куда попадёт ребёнок ровно четырнадцати лет при полосах «0–14» и
 * «14–18». (Ответ: в обе, и берётся первая в списке; об этом же скажет предупреждение.)
 */
function bandLabel(band: CustomAgeBand, index: number): string {
  const { minAge, maxAge } = band;
  if (minAge === undefined && maxAge === undefined) return `Диапазон ${index + 1}`;
  if (maxAge === undefined) return `${minAge ?? 0} и старше`;
  if (minAge === undefined) return `до ${maxAge} включительно`;
  return `${minAge}–${maxAge}`;
}

/**
 * Возрастные диапазоны нормы — вкладками, а не списком.
 *
 * Списком они шли строками, и у каждой строки набор полей был свой: у последней — лишняя кнопка
 * «добавить», у первой — подписи над полями, у остальных ни того, ни другого. Поля от строки к
 * строке поэтому съезжали, а у показателя с нормой и по полу, и по возрасту одна строка занимала
 * три: шесть числовых полей в ряд не помещаются даже на широком экране.
 *
 * Правят при этом **один** диапазон за раз — ровно как один показатель за раз в списке выше.
 * Поэтому вкладка называет границы («0–1», «18 и старше»), а поля всегда одни и те же и стоят на
 * одном месте: скакать нечему. Полоса вкладок при нехватке ширины прокручивается вбок — общим
 * правилом для всех полос вкладок, а не своим.
 */
function AgeBandsEditor({
  bands,
  bySex,
  onChange,
}: {
  bands: CustomAgeBand[];
  bySex: boolean;
  onChange: (bands: CustomAgeBand[]) => void;
}) {
  // Открытый диапазон называется своим `id`, а не номером: после удаления соседа номер означал бы
  // уже другой диапазон.
  const [openId, setOpenId] = useState<string | null>(null);
  const index = Math.max(0, bands.findIndex((band) => band.id === openId));
  const band = bands[index];

  const update = (next: CustomAgeBand) => onChange(bands.map((item, i) => (i === index ? next : item)));

  const add = () => {
    const created = emptyAgeBand();
    onChange([...bands, created]);
    setOpenId(created.id);
  };

  const remove = () => {
    const rest = bands.filter((_, i) => i !== index);
    const next = rest.length > 0 ? rest : [emptyAgeBand()];
    onChange(next);
    setOpenId(next[Math.min(index, next.length - 1)].id);
  };

  if (!band) return null;

  // Перекрытия и разрывы полос ничем себя не выдают: движок берёт первую подходящую, а на разрыве
  // честно помечает результат «нормы взяты приблизительно» — симптом виден, причина нет.
  const warnings = ageBandWarnings(bands);

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="nowrap" align="center">
        <Tabs value={band.id} onChange={(value) => setOpenId(value)} variant="pills">
          <Tabs.List>
            {bands.map((item, i) => (
              <Tabs.Tab key={item.id} value={item.id}>
                {bandLabel(item, i)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        <ActionIcon
          variant="light"
          color="brand"
          onClick={add}
          size="lg"
          radius="md"
          style={{ flexShrink: 0 }}
          aria-label="Добавить возрастной диапазон"
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Group>

      {warnings.length > 0 && (
        <Alert color="orange" variant="light" p="xs">
          <Stack gap={2}>
            {warnings.map((warning, i) => (
              <Text size="xs" key={i}>
                {warning}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Group gap="xs" align="flex-end" wrap="nowrap">
        {/* Знаки в подписях — не украшение: обе границы включающие, и без них четырнадцатилетний
            при полосах «0–14» и «14–18» попадает в обе, а врач об этом не знает. */}
        <NumberInput
          label="Возраст от (≥)"
          placeholder="0"
          min={0}
          max={120}
          size="sm"
          style={{ flex: 1, minWidth: 0 }}
          value={band.minAge ?? ''}
          onChange={(v) => update({ ...band, minAge: v === '' ? undefined : Number(v) })}
        />
        <NumberInput
          label="Возраст до (≤)"
          placeholder="и старше"
          min={0}
          max={120}
          size="sm"
          style={{ flex: 1, minWidth: 0 }}
          value={band.maxAge ?? ''}
          onChange={(v) => update({ ...band, maxAge: v === '' ? undefined : Number(v) })}
        />
        {!bySex && (
          <RangePair range={band} labels size="sm" suffix="общая" onChange={(range) => update({ ...band, ...range })} />
        )}
      </Group>

      {bySex && (
        <Stack gap={6}>
          {SEXES.map(({ field, title }, sexIndex) => (
            <Group key={field} gap="xs" align="flex-end" wrap="nowrap">
              <Text size="sm" w={92} style={{ flexShrink: 0 }} mb={6}>
                {title}
              </Text>
              <RangePair
                range={band[field]}
                /* Подписи — только над первой парой: вторая стоит ровно под ней теми же колонками. */
                labels={sexIndex === 0}
                size="sm"
                suffix={`${title.toLowerCase()}, ${bandLabel(band, index)}`}
                onChange={(range) => update({ ...band, [field]: range })}
              />
            </Group>
          ))}
        </Stack>
      )}

      <Group justify="flex-end">
        <Button
          variant="subtle"
          color="red"
          size="xs"
          leftSection={<IconTrash size={14} />}
          onClick={remove}
          disabled={bands.length <= 1}
        >
          Удалить диапазон
        </Button>
      </Group>
    </Stack>
  );
}

interface ParameterEditorRowProps {
  parameter: DraftParameter;
  onChange: (parameter: DraftParameter) => void;
  /** Принимает `uid`, чтобы обработчик был один на все строки — иначе мемоизация не работает. */
  onRemove: (uid: string) => void;
  open: boolean;
  /** Принимает `uid` по той же причине, что и `onRemove`. */
  onToggle: (uid: string) => void;
  keyError?: string;
}

/**
 * Строка списка свёрнута, и вместо полей у неё одна фраза: чем этот показатель отличается от
 * соседнего. Ключ — потому что на него ссылаются правила; единицы и норма — потому что именно их
 * приходят править. «Норма по полу» и «по возрасту» названы словами, а не числами: числа там разные
 * для каждой полосы, и в одну строку они не складываются.
 */
function summarize(parameter: DraftParameter): string {
  const parts = [parameter.key || 'без ключа'];
  if (parameter.inputType === 'select') parts.push('список значений');
  else if (parameter.inputType === 'derived') parts.push('вычисляется по формуле');
  else {
    if (parameter.unit) parts.push(parameter.unit);
    if (parameter.ageBands?.length) parts.push('норма по возрасту');
    else if (parameter.bySex) parts.push('норма по полу');
    else if (parameter.min !== undefined && parameter.max !== undefined) parts.push(`норма ${parameter.min}–${parameter.max}`);
    // Односторонняя норма пишется словом, а не многоточием: «норма …–0» читается как ошибка, тогда
    // как «норма до 0» — обычное дело для показателя, которого в норме быть не должно.
    else if (parameter.max !== undefined) parts.push(`норма до ${parameter.max}`);
    else if (parameter.min !== undefined) parts.push(`норма от ${parameter.min}`);
  }
  return parts.join(' · ');
}

function ParameterEditorRowView({ parameter, onChange, onRemove, open, onToggle, keyError }: ParameterEditorRowProps) {
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
  const bySex = Boolean(parameter.bySex);
  const hasRange = parameter.inputType === 'number' || parameter.inputType === 'derived';

  const toggleByAge = (enabled: boolean) => {
    onChange({ ...parameter, ageBands: enabled ? [emptyAgeBand()] : undefined });
  };

  /**
   * Включение и выключение нормы по полу переносит уже введённые числа.
   *
   * Включаем — обе нормы начинаются с общей: чаще всего они отличаются одной границей, и заставлять
   * набирать всё заново значило бы предлагать выбор «удобно или правильно». Выключаем — общей
   * становится мужская: она стоит первой, её и видно на экране.
   */
  const toggleBySex = (enabled: boolean) => {
    const move = <T extends SexedRow>(row: T): T =>
      enabled
        ? { ...row, male: { min: row.min, max: row.max }, female: { min: row.min, max: row.max } }
        : { ...row, min: row.male?.min, max: row.male?.max, male: undefined, female: undefined };
    const moved = move(parameter as SexedRow);
    onChange({
      ...parameter,
      ...moved,
      bySex: enabled || undefined,
      ageBands: parameter.ageBands?.map((band) => ({ ...band, ...move(band) })),
    });
  };

  return (
    <CollapsibleRow
      kind="Показатель"
      title={parameter.label}
      summary={summarize(parameter)}
      open={open}
      onToggle={() => onToggle(parameter.uid)}
      onRemove={() => onRemove(parameter.uid)}
      invalid={!parameter.label.trim() || !parameter.key.trim() || Boolean(keyError)}
    >
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

        {hasRange && !byAge && !bySex && (
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Group gap="xs" align="flex-end" wrap="nowrap">
              <RangePair
                range={parameter}
                labels
                suffix="общая"
                onChange={(range) => onChange({ ...parameter, ...range })}
              />
            </Group>
          </Grid.Col>
        )}

        {hasRange && !byAge && bySex && (
          <Grid.Col span={12}>
            <Stack gap={6}>
              {SEXES.map(({ field, title }, index) => (
                <Group key={field} gap="xs" align="flex-end" wrap="nowrap">
                  <Text size="sm" w={92} style={{ flexShrink: 0 }} mb={6}>
                    {title}
                  </Text>
                  <RangePair
                    range={parameter[field]}
                    labels={index === 0}
                    suffix={title.toLowerCase()}
                    onChange={(range) => onChange({ ...parameter, [field]: range })}
                  />
                </Group>
              ))}
            </Stack>
          </Grid.Col>
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

        {hasRange && (
          <Grid.Col span={12}>
            <Group gap="xl" wrap="wrap">
              <Switch
                label="Норма зависит от возраста"
                description="Задайте несколько возрастных диапазонов вместо одной общей нормы"
                checked={byAge}
                onChange={(e) => toggleByAge(e.currentTarget.checked)}
              />
              <Switch
                label="Норма зависит от пола"
                description="Отдельные границы для мужчин и женщин — их можно сочетать с возрастом"
                checked={bySex}
                onChange={(e) => toggleBySex(e.currentTarget.checked)}
              />
            </Group>
          </Grid.Col>
        )}

        {hasRange && byAge && (
          <Grid.Col span={12}>
            <Divider mb="sm" />
            <Text size="sm" fw={500} mb={6}>
              Возрастные диапазоны нормы
            </Text>
            <AgeBandsEditor
              bands={parameter.ageBands ?? []}
              bySex={bySex}
              onChange={(ageBands) => onChange({ ...parameter, ageBands })}
            />
            <Text size="xs" c="dimmed" mt="sm">
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
                  <ActionIcon aria-label="Удалить возрастной диапазон" variant="subtle" color="red" onClick={() => removeOption(index)}>
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              ))}
              <ActionIcon aria-label="Добавить возрастной диапазон" variant="light" color="brand" onClick={addOption} size="lg" radius="md">
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
    </CollapsibleRow>
  );
}

/**
 * Строка мемоизирована: в анализе бывает три десятка показателей, и каждая строка — это два десятка
 * полей Mantine. Без этого любая правка **где угодно на странице** (в том числе цифра, набранная в
 * предпросмотре справа) перерисовывала все шестьсот полей разом. Условие мемоизации — постоянные
 * обработчики: они объявлены один раз на всю страницу, а строка называет себя сама (`uid`).
 */
export const ParameterEditorRow = memo(ParameterEditorRowView);
