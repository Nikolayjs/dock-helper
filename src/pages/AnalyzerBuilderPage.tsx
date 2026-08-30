import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Alert, Badge, Button, Card, Container, Grid, Group, Loader, NumberInput, ScrollArea, SegmentedControl, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArrowLeft, IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { analyzeTest } from '../features/analyzer/analyzerEngine';
import { AnalyzerResults } from '../features/analyzer/AnalyzerResults';
import { ParameterEditorRow, type DraftParameter } from '../features/analyzer/builder/ParameterEditorRow';
import { toParamKey } from '../features/analyzer/import/paramKey';
import type { ParsedAnalyte } from '../features/analyzer/import/parseLabValues';
import { PatternRuleEditorRow, type DraftPatternRule } from '../features/analyzer/builder/PatternRuleEditorRow';
import {
  describePatternNode,
  hydrateLabTest,
  labTestDraftToPayload,
  toLabTestDefinition,
  type CustomRange,
  type LabTestDraft,
} from '../features/analyzer/customTypes';
import { LabTestForm } from '../features/analyzer/LabTestForm';
import type { Sex } from '../features/analyzer/types';
import { QUERY_KEY as LAB_TESTS_KEY, useCustomAnalyzers } from '../features/analyzer/useCustomAnalyzers';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { useMediaQuery } from '@mantine/hooks';
import { FormActions } from '../components/common/FormActions';
import { useStickyFitHeight } from '../components/common/useStickyFitHeight';
import { STICKY_TOP } from '../layouts/shellMetrics';
import { useDirtyValue, useUnsavedGuard } from '../components/common/unsavedChanges';
import { useSaveAction } from '../components/common/useSaveAction';

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function emptyParameter(): DraftParameter {
  return { uid: crypto.randomUUID(), key: '', label: '', inputType: 'number', lowCauses: [], highCauses: [] };
}

function emptyRule(): DraftPatternRule {
  return { uid: crypto.randomUUID(), id: crypto.randomUUID(), title: '', severity: 'warning', causes: [], operator: 'and', conditions: [] };
}

/**
 * Seeds the parameter rows from analytes a lab file offered that no existing analyzer claimed.
 *
 * Name and unit come from the file; reference ranges deliberately do not. Laboratories print their
 * own intervals, which vary by method and by analyser, and importing one as if it were the doctor's
 * own would put a number they never chose in charge of what gets flagged.
 */
function parametersFromAnalytes(analytes: ParsedAnalyte[]): DraftParameter[] {
  const taken = new Set<string>();
  return analytes.map((analyte) => ({
    uid: crypto.randomUUID(),
    key: toParamKey(analyte.name, taken),
    label: analyte.name,
    unit: analyte.unit,
    inputType: 'number' as const,
    lowCauses: [],
    highCauses: [],
  }));
}

export function AnalyzerBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const seedAnalytes = (useLocation().state as { seedAnalytes?: ParsedAnalyte[] } | null)?.seedAnalytes;
  const { customTests, addTest, updateTest, deleteTest } = useCustomAnalyzers();
  const confirmDelete = useDeleteWithConfirm();

  const editingTest = isEditMode ? customTests.find((t) => t.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [shortTitle, setShortTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parameters, setParameters] = useState<DraftParameter[]>(() =>
    seedAnalytes && seedAnalytes.length > 0 ? parametersFromAnalytes(seedAnalytes) : [emptyParameter()],
  );
  const [rules, setRules] = useState<DraftPatternRule[]>([]);
  const [hydrated, setHydrated] = useState(!isEditMode);
  const [previewValues, setPreviewValues] = useState<Record<string, number | undefined>>({});
  const [previewSex, setPreviewSex] = useState<Sex>('male');
  const [previewAge, setPreviewAge] = useState<number | undefined>(undefined);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (editingTest && !hydrated) {
      // A test like the seeded ОАК (30 parameters, 11 rules) mounts ~40 heavy Mantine form rows in
      // one go — done as a plain synchronous update this blocked the tab for several seconds right
      // after clicking "Изменить". startTransition lets React render it as interruptible background
      // work instead, so the loading state below keeps painting/responding while it catches up.
      startTransition(() => {
        const draft = hydrateLabTest(editingTest);
        setTitle(draft.title);
        setShortTitle(draft.shortTitle);
        setDescription(draft.description);
        setParameters(draft.parameters.map((p) => ({ ...p, uid: crypto.randomUUID() })));
        setRules(draft.patterns.map((r) => ({ ...r, uid: crypto.randomUUID() })));
        setHydrated(true);
      });
    }
  }, [editingTest, hydrated]);

  const paramKeys = parameters.map((p) => p.key.trim()).filter(Boolean);
  const paramOptions = parameters
    .filter((p) => p.key.trim())
    .map((p) => ({ key: p.key.trim(), label: p.label || p.key }));
  const paramLabelByKey = Object.fromEntries(parameters.map((p) => [p.key, p.label || p.key]));

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push('Укажите название анализа.');
    if (!shortTitle.trim()) list.push('Укажите короткое название для вкладки.');
    if (parameters.length === 0) list.push('Добавьте хотя бы один показатель.');

    const seenKeys = new Set<string>();
    for (const param of parameters) {
      const key = param.key.trim();
      if (!param.label.trim()) list.push('У каждого показателя должно быть название.');
      if (!key) {
        list.push('У каждого показателя должен быть ключ.');
      } else if (!IDENTIFIER_RE.test(key)) {
        list.push(`Ключ «${key}» недопустим: только латиница, цифры и «_», не начиная с цифры.`);
      } else if (seenKeys.has(key)) {
        list.push(`Ключ «${key}» используется дважды.`);
      }
      seenKeys.add(key);

      if (param.inputType === 'select' && !(param.options ?? []).some((o) => o.label.trim())) {
        list.push(`У показателя «${param.label || key}» нужен хотя бы один вариант выбора.`);
      }
      // Проверяются те границы, которые показатель действительно использует: при норме по полу это
      // мужская и женская пары, при общей — одна. Иначе перевёрнутая женская норма проходила бы молча.
      const pairsOf = (row: { min?: number; max?: number; male?: CustomRange; female?: CustomRange }) =>
        param.bySex ? [row.male, row.female] : [{ min: row.min, max: row.max }];
      const inverted = (pairs: (CustomRange | undefined)[]) =>
        pairs.some((r) => r?.min !== undefined && r.max !== undefined && r.min > r.max);

      if (param.inputType === 'number' && !param.ageBands?.length && inverted(pairsOf(param))) {
        list.push(`У показателя «${param.label || key}» минимум нормы больше максимума.`);
      }
      if (param.inputType === 'number' && param.ageBands?.length) {
        for (const band of param.ageBands) {
          if (band.minAge !== undefined && band.maxAge !== undefined && band.minAge > band.maxAge) {
            list.push(`У показателя «${param.label || key}» в одном из возрастных диапазонов «возраст от» больше «возраст до».`);
          }
          if (inverted(pairsOf(band))) {
            list.push(`У показателя «${param.label || key}» в одном из возрастных диапазонов минимум нормы больше максимума.`);
          }
        }
      }
    }

    for (const rule of rules) {
      if (!rule.title.trim()) list.push('У каждого правила должно быть заключение.');
      if (!rule.locked) {
        if (rule.conditions.length === 0) {
          list.push(`У правила «${rule.title || 'без названия'}» нет условий срабатывания.`);
        } else {
          const unknown = rule.conditions.filter((c) => c.kind === 'param' && !paramKeys.includes(c.paramKey));
          if (unknown.length > 0) list.push(`Правило «${rule.title || 'без названия'}» ссылается на несуществующий показатель.`);
          // Правило из одних условий о пациенте не смотрит на анализ вовсе: оно сработает на каждом
          // анализе подходящего пола — то есть заключение появится там, где его ничем не подтвердили.
          if (rule.conditions.every((c) => c.kind === 'sex')) {
            list.push(
              `Правило «${rule.title || 'без названия'}» состоит только из условий о пациенте: добавьте хотя бы один показатель, иначе оно сработает на любом анализе.`,
            );
          }
        }
      }
    }

    return list;
  }, [title, shortTitle, parameters, rules, paramKeys]);

  const previewDraft: LabTestDraft = useMemo(
    () => ({
      title: title || 'Новый анализ',
      shortTitle: shortTitle || 'Превью',
      description,
      parameters: parameters
        .filter((p) => p.key.trim())
        .map(({ uid: _uid, ...param }) => param),
      patterns: rules.map(({ uid: _uid, ...rule }) => rule),
    }),
    [title, shortTitle, description, parameters, rules],
  );

  const previewLabTest = useMemo(
    () => toLabTestDefinition({ id: 'preview', createdAt: '', updatedAt: '', ...labTestDraftToPayload(previewDraft) }),
    [previewDraft],
  );
  const previewResult = useMemo(
    () => analyzeTest(previewLabTest, previewValues, previewSex, previewAge),
    [previewLabTest, previewValues, previewSex, previewAge],
  );

  /**
   * Предпросмотр кончается там, где кончается экран, а не там, где насчитала формула из `100vh`.
   *
   * Высота берётся по худшему из двух положений прилипшего блока — до прокрутки он начинается ниже
   * (замер: 144 против 84 после), — и снизу вычитается прилипшая панель «Сохранить». На прокрутке
   * не считается ничего: пересчёт на каждый кадр перерисовывал страницу с тремя десятками карточек
   * показателей и давал те самые фризы.
   */
  const previewRef = useRef<HTMLDivElement>(null);
  /**
   * Прилипает предпросмотр только там, где он стоит **рядом** с формой.
   *
   * Ниже `lg` колонки складываются друг под друга, и предпросмотр оказывается в конце страницы: там
   * ему незачем ни прилипать, ни ужиматься до экрана — до него просто прокручивают и смотрят
   * целиком. Замер на телефоне без этого условия: колонка 320 px (пол) вместо естественных полутора
   * тысяч, то есть окошко в треть экрана вместо документа.
   */
  const sideBySide = useMediaQuery('(min-width: 75em)', true, { getInitialValueInEffect: false });
  // `ready` обязателен: до прихода записи страница показывает загрузку и блока не рисует вовсе.
  const previewHeight = useStickyFitHeight(previewRef, {
    gap: 16,
    min: 320,
    ready: sideBySide && (!isEditMode || hydrated),
  });

  const guard = useUnsavedGuard(useDirtyValue({ title, shortTitle, description, parameters, rules }, hydrated));

  const { saving, save: handleSave } = useSaveAction(guard, async () => {
    if (errors.length > 0) return;
    const payload = labTestDraftToPayload(previewDraft);

    if (editingTest) {
      await updateTest(editingTest.id, payload);
      notifications.show({ message: 'Анализ обновлён', color: 'teal' });
      navigate('/analyzer');
    } else {
      await addTest(payload);
      notifications.show({ message: 'Свой анализ создан', color: 'teal' });
      navigate('/analyzer');
    }
  });

  if (isEditMode && !hydrated) {
    return (
      <Container size="xl" px={0}>
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      </Container>
    );
  }

  const handleDelete = () => {
    if (!editingTest) return;
    confirmDelete({
      what: 'анализ',
      name: editingTest.title,
      notice: 'Анализ удалён',
      queryKey: LAB_TESTS_KEY,
      id: editingTest.id,
      perform: () => deleteTest(editingTest.id),
      onConfirmed: () => navigate('/analyzer'),
    });
  };

  return (
    <Container size="xl" px={0}>
      <Group justify="space-between" mb="lg">
        <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/analyzer')}>
          К анализатору
        </Button>
        {editingTest && (
          <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
            Удалить
          </Button>
        )}
      </Group>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            <Card withBorder padding="lg">
              <Title order={4} mb="md">
                Основное
              </Title>
              <Stack gap="md">
                <TextInput label="Название анализа" placeholder="Например: Гормоны щитовидной железы" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
                <TextInput label="Короткое название (для вкладки)" placeholder="Например: ТТГ" value={shortTitle} onChange={(e) => setShortTitle(e.currentTarget.value)} required />
                <Textarea label="Описание" placeholder="Коротко: что входит в этот анализ" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Показатели</Title>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setParameters((prev) => [...prev, emptyParameter()])}>
                  Добавить показатель
                </Button>
              </Group>
              <Stack gap="sm">
                {parameters.map((param) => (
                  <ParameterEditorRow
                    key={param.uid}
                    parameter={param}
                    onChange={(next) => setParameters((prev) => prev.map((p) => (p.uid === next.uid ? next : p)))}
                    onRemove={() => setParameters((prev) => prev.filter((p) => p.uid !== param.uid))}
                  />
                ))}
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Правила интерпретации</Title>
                  <Text size="sm" c="dimmed">
                    Необязательно: заключения, которые появляются при сочетании отклонений (например, «повышен ТТГ» И «понижен Т4»).
                  </Text>
                </div>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setRules((prev) => [...prev, emptyRule()])} disabled={paramOptions.length === 0}>
                  Добавить правило
                </Button>
              </Group>
              <Stack gap="sm">
                {rules.map((rule) => (
                  <PatternRuleEditorRow
                    key={rule.uid}
                    rule={rule}
                    paramOptions={paramOptions}
                    lockedSummary={rule.locked && rule.rawRoot ? describePatternNode(rule.rawRoot, (key) => paramLabelByKey[key] ?? key) : undefined}
                    onChange={(next) => setRules((prev) => prev.map((r) => (r.uid === next.uid ? next : r)))}
                    onRemove={() => setRules((prev) => prev.filter((r) => r.uid !== rule.uid))}
                  />
                ))}
              </Stack>
            </Card>

            {errors.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Проверьте форму">
                <Stack gap={2}>
                  {errors.map((err, i) => (
                    <Text size="sm" key={i}>
                      • {err}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            {guard.render({ onSave: errors.length === 0 ? handleSave : undefined })}

            <FormActions>
              <Group justify="flex-end">
                <Button size="md" leftSection={<IconDeviceFloppy size={18} />} onClick={handleSave} loading={saving} disabled={errors.length > 0}>
                  {editingTest ? 'Сохранить изменения' : 'Создать анализ'}
                </Button>
              </Group>
            </FormActions>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          {/*
            Предпросмотр прилипший и со своей прокруткой — он нужен на виду, пока правят показатели.

            **Прокручивается содержимое карточки, а не карточка.** Сначала было наоборот: обе
            карточки лежали внутри области прокрутки, и карточка предпросмотра, будучи выше окна,
            обрезалась её краем — вместо карточки со скруглёнными углами выходил прямоугольник,
            уходящий за край. Теперь высоту получает сама карточка, а прокручивается список
            показателей внутри неё: карточка остаётся карточкой в любом положении.

            Полоса прокрутки — `ScrollArea`, а не `overflow: auto`: родная отнимала у блока 10 px и
            рисовалась **справа от карточки**, прямо на обоях, отдельной чертой. У `ScrollArea` она
            лежит поверх содержимого, внутри поверхности, — как в сайдбаре и в поиске по шапке.
          */}
          <div
            ref={previewRef}
            style={{
              position: sideBySide ? 'sticky' : undefined,
              top: sideBySide ? `calc(${STICKY_TOP} + 16px)` : undefined,
              height: sideBySide ? (previewHeight ?? undefined) : undefined,
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--mantine-spacing-lg)',
            }}
          >
              <Card withBorder padding="lg" style={sideBySide ? { flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined}>
                {/*
                  Шапка карточки не сжимается, и это не мелочь: в flex-колонке сжимается **всё**, что
                  не сказало обратного, — включая бейдж высотой в строку. Замер до правки: бейдж
                  «Предпросмотр» 12 px вместо 20, то есть текст, обрезанный по горизонтали пополам.
                */}
                <div style={{ flexShrink: 0 }}>
                  <Badge variant="light" color="gray" mb="xs">
                    Предпросмотр
                  </Badge>
                  <Title order={4} mb={4}>
                    {previewLabTest.title}
                  </Title>
                  <Text size="sm" c="dimmed" mb="lg">
                    {previewLabTest.description || 'Описание появится здесь'}
                  </Text>

                  <Group gap="sm" mb="lg">
                    <NumberInput
                      value={previewAge ?? ''}
                      onChange={(v) => setPreviewAge(v === '' ? undefined : Number(v))}
                      placeholder="Возраст, лет"
                      min={0}
                      max={120}
                      w={140}
                      radius="md"
                    />
                    <SegmentedControl
                      value={previewSex}
                      onChange={(v) => setPreviewSex(v as Sex)}
                      data={[
                        { value: 'male', label: 'Мужской' },
                        { value: 'female', label: 'Женский' },
                      ]}
                    />
                  </Group>
                </div>

                <ScrollArea style={sideBySide ? { flex: '1 1 auto', minHeight: 0 } : undefined} type="auto" scrollbars="y">
                  <LabTestForm
                    test={previewLabTest}
                    sex={previewSex}
                    age={previewAge}
                    values={previewValues}
                    computedValues={previewResult.values}
                    statuses={previewResult.statuses}
                    onChange={(key, value) => setPreviewValues((prev) => ({ ...prev, [key]: value }))}
                  />
                </ScrollArea>
              </Card>
              {/*
                Заключения занимают ровно свою высоту — `0 0 auto`, а не `0 1 auto`.

                Со сжатием их карточку резало так же, как раньше резало предпросмотр: пустое
                состояние «Введите показатели анализа» высотой 245 px ужималось до 85 и обрывалось
                на полуслове. Место в колонке отдаёт предпросмотр — ему есть что прокручивать, а
                короткому блоку сжиматься некуда. Потолок в 40 % остаётся на случай разбора с
                десятком совпавших правил: иначе он выдавил бы сам предпросмотр.
              */}
              <ScrollArea style={sideBySide ? { flex: '0 0 auto', minHeight: 0, maxHeight: '40%' } : undefined} type="auto" scrollbars="y">
                <AnalyzerResults result={previewResult} />
              </ScrollArea>
          </div>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
