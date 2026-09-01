import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { PageToolbar } from '../components/common/PageToolbar';
import { Alert, Badge, Box, Button, Card, Container, Group, Loader, NumberInput, ScrollArea, SegmentedControl, Stack, Tabs, Text, TextInput, Textarea, Title } from '@mantine/core';
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
import { BuilderLayout } from '../components/common/BuilderLayout';
import { FormActions } from '../components/common/FormActions';
import { useScreenFitHeight } from '../components/common/useScreenFitHeight';
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

  /**
   * Списки, выведенные из показателей, обязаны быть мемоизированы — иначе мемоизация строк не
   * работает вовсе.
   *
   * `paramOptions` уходит пропсом в **каждое** правило: новый массив на каждый рендер означал, что
   * `memo` у строки правила не совпадал никогда. Замер на ОАК с 21 правилом: одна цифра, набранная
   * в предпросмотре справа, давала 531 правку DOM в карточках правил — то есть перерисовку всех
   * трёхсот с лишним полей ради значения, к которому они не имеют отношения.
   */
  /*
   * Открыта ровно одна строка списка, и это несущее решение, а не экономия.
   *
   * Правят один показатель за раз: открытая строка — это и есть «что я сейчас редактирую». Дав
   * открыть несколько, мы вернули бы ту же бесконечную страницу, ради которой всё затевалось, — и
   * при этом на любой набранной букве перерисовывали бы все открытые строки разом.
   */
  const [openParam, setOpenParam] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [section, setSection] = useState('main');

  const toggleParam = useCallback((uid: string) => setOpenParam((cur) => (cur === uid ? null : uid)), []);
  const toggleRule = useCallback((uid: string) => setOpenRule((cur) => (cur === uid ? null : uid)), []);

  const paramKeys = useMemo(() => parameters.map((p) => p.key.trim()).filter(Boolean), [parameters]);
  const paramOptions = useMemo(
    () => parameters.filter((p) => p.key.trim()).map((p) => ({ key: p.key.trim(), label: p.label || p.key })),
    [parameters],
  );
  const paramLabelByKey = useMemo(
    () => Object.fromEntries(parameters.map((p) => [p.key, p.label || p.key])),
    [parameters],
  );

  /*
   * Каждая ошибка знает свой раздел, и это не украшение.
   *
   * Разделы разнесены по вкладкам, а значит две трети формы в любой момент **не на экране**. Список
   * ошибок, не говорящий, где искать, превратился бы в жалобу без адреса: «у каждого показателя
   * должен быть ключ» — у какого? Отсюда отметка на вкладке и переход к разделу по нажатию на
   * саму ошибку. Источник один: и список, и отметки считаются здесь.
   */
  const problems = useMemo(() => {
    const list: { section: 'main' | 'params' | 'rules'; text: string }[] = [];
    const push = (section: 'main' | 'params' | 'rules') => (text: string) => list.push({ section, text });
    const main = { push: push('main') };
    const params = { push: push('params') };
    const rulesSection = { push: push('rules') };

    if (!title.trim()) main.push('Укажите название анализа.');
    if (!shortTitle.trim()) main.push('Укажите короткое название для вкладки.');
    if (parameters.length === 0) params.push('Добавьте хотя бы один показатель.');

    const seenKeys = new Set<string>();
    for (const param of parameters) {
      const key = param.key.trim();
      if (!param.label.trim()) params.push('У каждого показателя должно быть название.');
      if (!key) {
        params.push('У каждого показателя должен быть ключ.');
      } else if (!IDENTIFIER_RE.test(key)) {
        params.push(`Ключ «${key}» недопустим: только латиница, цифры и «_», не начиная с цифры.`);
      } else if (seenKeys.has(key)) {
        params.push(`Ключ «${key}» используется дважды.`);
      }
      seenKeys.add(key);

      if (param.inputType === 'select' && !(param.options ?? []).some((o) => o.label.trim())) {
        params.push(`У показателя «${param.label || key}» нужен хотя бы один вариант выбора.`);
      }
      // Проверяются те границы, которые показатель действительно использует: при норме по полу это
      // мужская и женская пары, при общей — одна. Иначе перевёрнутая женская норма проходила бы молча.
      const pairsOf = (row: { min?: number; max?: number; male?: CustomRange; female?: CustomRange }) =>
        param.bySex ? [row.male, row.female] : [{ min: row.min, max: row.max }];
      const inverted = (pairs: (CustomRange | undefined)[]) =>
        pairs.some((r) => r?.min !== undefined && r.max !== undefined && r.min > r.max);

      if (param.inputType === 'number' && !param.ageBands?.length && inverted(pairsOf(param))) {
        params.push(`У показателя «${param.label || key}» минимум нормы больше максимума.`);
      }
      if (param.inputType === 'number' && param.ageBands?.length) {
        for (const band of param.ageBands) {
          if (band.minAge !== undefined && band.maxAge !== undefined && band.minAge > band.maxAge) {
            params.push(`У показателя «${param.label || key}» в одном из возрастных диапазонов «возраст от» больше «возраст до».`);
          }
          if (inverted(pairsOf(band))) {
            params.push(`У показателя «${param.label || key}» в одном из возрастных диапазонов минимум нормы больше максимума.`);
          }
        }
      }
    }

    for (const rule of rules) {
      if (!rule.title.trim()) rulesSection.push('У каждого правила должно быть заключение.');
      if (!rule.locked) {
        if (rule.conditions.length === 0) {
          rulesSection.push(`У правила «${rule.title || 'без названия'}» нет условий срабатывания.`);
        } else {
          const unknown = rule.conditions.filter((c) => c.kind === 'param' && !paramKeys.includes(c.paramKey));
          if (unknown.length > 0) rulesSection.push(`Правило «${rule.title || 'без названия'}» ссылается на несуществующий показатель.`);
          // Правило из одних условий о пациенте не смотрит на анализ вовсе: оно сработает на каждом
          // анализе подходящего пола — то есть заключение появится там, где его ничем не подтвердили.
          if (rule.conditions.every((c) => c.kind === 'sex')) {
            rulesSection.push(
              `Правило «${rule.title || 'без названия'}» состоит только из условий о пациенте: добавьте хотя бы один показатель, иначе оно сработает на любом анализе.`,
            );
          }
        }
      }
    }

    return list;
  }, [title, shortTitle, parameters, rules, paramKeys]);

  const errors = useMemo(() => problems.map((p) => p.text), [problems]);
  /** Раздел помечен, только если мешает сохранению именно он. */
  const invalidSections = useMemo(() => new Set(problems.map((p) => p.section)), [problems]);

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
  /**
   * Обработчики объявлены один раз на всю страницу — это условие мемоизации строк.
   *
   * Со стрелкой прямо в разметке (`onChange={(next) => setParameters(...)}`) у каждой из трёх
   * десятков строк на каждый рендер появлялся новый пропс, и `memo` не спасал бы вовсе: одна цифра,
   * набранная в предпросмотре, перерисовывала весь редактор. Обновление функциональное, поэтому
   * зависимостей у обработчиков нет.
   */
  const updateParameter = useCallback((next: DraftParameter) => {
    setParameters((prev) => prev.map((p) => (p.uid === next.uid ? next : p)));
  }, []);
  const removeParameter = useCallback((uid: string) => {
    setParameters((prev) => prev.filter((p) => p.uid !== uid));
  }, []);
  /*
   * Новая строка приходит открытой: её и завели, чтобы заполнить. Свёрнутая пустая строка внизу
   * длинного списка выглядела бы так, будто нажатие не сработало.
   */
  const addParameter = useCallback(() => {
    const created = emptyParameter();
    setParameters((prev) => [...prev, created]);
    setOpenParam(created.uid);
  }, []);
  const updateRule = useCallback((next: DraftPatternRule) => {
    setRules((prev) => prev.map((r) => (r.uid === next.uid ? next : r)));
  }, []);
  const removeRule = useCallback((uid: string) => {
    setRules((prev) => prev.filter((r) => r.uid !== uid));
  }, []);
  const addRule = useCallback(() => {
    const created = emptyRule();
    setRules((prev) => [...prev, created]);
    setOpenRule(created.uid);
  }, []);
  const changePreviewValue = useCallback((key: string, value: number | undefined) => {
    setPreviewValues((prev) => ({ ...prev, [key]: value }));
  }, []);

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
  const screenLeft = useScreenFitHeight(previewRef, {
    gap: 16,
    min: 320,
    ready: sideBySide && (!isEditMode || hydrated),
  });
  /**
   * Карточке предпросмотра — 70 % свободного экрана, заключениям — сколько попросят.
   *
   * Раньше колонка целиком равнялась экрану и делилась внутри себя: заключения при этом всегда
   * упирались в свой потолок и обрывались на полуслове, а любое введённое значение меняло высоты
   * обеих карточек. Теперь высота задана **только форме** — ей есть что прокручивать, и предел ей
   * нужен, — а заключения растут естественно и уезжают вместе со страницей. Оборванных карточек не
   * остаётся вовсе: прокручивается страница, а не блок внутри блока.
   */
  const previewHeight = screenLeft ? Math.round(screenLeft * 0.7) : null;

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
      {/* Между полосами управления — обычный просвет страницы. Отступ снизу внутри самой
          панели давал бы то же на глаз, но панели при этом стояли бы вплотную: замер на
          конструкторе анализа — зазор 0 при пустой полосе в 20 px внутри верхней. */}
      <Box mb="lg">
        <PageToolbar>
          <Group justify="space-between">
            <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/analyzer')}>
              К анализатору
            </Button>
            {editingTest && (
              <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                Удалить
              </Button>
            )}
          </Group>
        </PageToolbar>
      </Box>

      <BuilderLayout
        editor={
          <>
            {/*
              Разделы конструктора — вкладки, а не три карточки подряд.
              
              Общий анализ крови — тридцать показателей и одиннадцать правил; в развёрнутом виде это
              была страница на 35 638 px (сорок экранов на компьютере, пятьдесят пять на телефоне) с
              978 полями ввода. Правят при этом всегда что-то одно: название анализа, показатель или
              правило. `keepMounted={false}` — условие, ради которого всё и делалось: закрытая
              вкладка не отрисована вовсе, а не спрятана стилем.
              
              Отметка на вкладке показывает, что именно в этом разделе мешает сохранению: две трети
              формы в любой момент не на экране, и список ошибок без адреса заставлял бы искать их
              по всем вкладкам.
            */}
            <Tabs value={section} onChange={(v) => setSection(v ?? 'main')} variant="pills" keepMounted={false}>
              {/* Вкладки разделов конструктора — на поверхности, как верхушка любой страницы. */}
              <Box mb="lg">
                <PageToolbar
                  tabs={
              <Tabs.List>
                <Tabs.Tab
                  value="main"
                  rightSection={invalidSections.has('main') ? <IconAlertTriangle size={13} color="var(--mantine-color-orange-6)" /> : undefined}
                >
                  Основное
                </Tabs.Tab>
                <Tabs.Tab
                  value="params"
                  rightSection={
                    invalidSections.has('params') ? (
                      <IconAlertTriangle size={13} color="var(--mantine-color-orange-6)" />
                    ) : (
                      <Badge size="xs" variant="light" color="gray">
                        {parameters.length}
                      </Badge>
                    )
                  }
                >
                  Показатели
                </Tabs.Tab>
                <Tabs.Tab
                  value="rules"
                  rightSection={
                    invalidSections.has('rules') ? (
                      <IconAlertTriangle size={13} color="var(--mantine-color-orange-6)" />
                    ) : (
                      <Badge size="xs" variant="light" color="gray">
                        {rules.length}
                      </Badge>
                    )
                  }
                >
                  Правила
                </Tabs.Tab>
              </Tabs.List>
                  }
                />
              </Box>

              <Tabs.Panel value="main">
                <Card withBorder padding="lg">
                  <Stack gap="md">
                    <TextInput label="Название анализа" placeholder="Например: Гормоны щитовидной железы" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
                    <TextInput label="Короткое название (для вкладки)" placeholder="Например: ТТГ" value={shortTitle} onChange={(e) => setShortTitle(e.currentTarget.value)} required />
                    <Textarea label="Описание" placeholder="Коротко: что входит в этот анализ" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
                  </Stack>
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="params">
                <Card withBorder padding="lg">
                  <Group justify="space-between" mb="md">
                    <Text size="sm" c="dimmed">
                      Нажмите на показатель, чтобы открыть его поля
                    </Text>
                    <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addParameter}>
                      Добавить показатель
                    </Button>
                  </Group>
                  <Stack gap="sm">
                    {parameters.map((param) => (
                      <ParameterEditorRow
                        key={param.uid}
                        parameter={param}
                        open={openParam === param.uid}
                        onToggle={toggleParam}
                        onChange={updateParameter}
                        onRemove={removeParameter}
                      />
                    ))}
                  </Stack>
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="rules">
                <Card withBorder padding="lg">
                  <Group justify="space-between" mb="md" align="flex-start" wrap="nowrap">
                    <Text size="sm" c="dimmed">
                      Необязательно: заключения, которые появляются при сочетании отклонений (например, «повышен ТТГ» И «понижен Т4»).
                    </Text>
                    <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={addRule} disabled={paramOptions.length === 0} style={{ flexShrink: 0 }}>
                      Добавить правило
                    </Button>
                  </Group>
                  <Stack gap="sm">
                    {rules.map((rule) => (
                      <PatternRuleEditorRow
                        key={rule.uid}
                        rule={rule}
                        paramOptions={paramOptions}
                        open={openRule === rule.uid}
                        onToggle={toggleRule}
                        lockedSummary={rule.locked && rule.rawRoot ? describePatternNode(rule.rawRoot, (key) => paramLabelByKey[key] ?? key) : undefined}
                        onChange={updateRule}
                        onRemove={removeRule}
                      />
                    ))}
                  </Stack>
                </Card>
              </Tabs.Panel>
            </Tabs>

            {problems.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Проверьте форму">
                <Stack gap={2}>
                  {problems.map((problem, i) => (
                    /* Нажатие уводит в тот раздел, где ошибка: искать её по вкладкам вручную —
                       ровно то, ради чего отметка и заводилась. */
                    <Text
                      size="sm"
                      key={i}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSection(problem.section)}
                    >
                      • {problem.text}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            {guard.render({ onSave: errors.length === 0 ? handleSave : undefined })}
          </>
        }
        actions={
          <FormActions>
            <Group justify="flex-end">
              <Button size="md" leftSection={<IconDeviceFloppy size={18} />} onClick={handleSave} loading={saving} disabled={errors.length > 0}>
                {editingTest ? 'Сохранить изменения' : 'Создать анализ'}
              </Button>
            </Group>
          </FormActions>
        }
        preview={
          /*
            Предпросмотр не прикреплён к экрану, и это следствие того, что заключения растут
            свободно: прикреплённая карточка осталась бы висеть на месте, а разбор уезжал бы **под
            неё** — он идёт следующим в потоке и рисуется ниже. Прокручивается страница целиком.

            Прокрутка внутри осталась ровно одна — список показателей внутри карточки формы. Полоса
            у неё `ScrollArea`, а не родная: родная отнимала бы у блока 10 px и рисовалась справа от
            карточки, прямо на обоях, отдельной чертой.
          */
          <Stack gap="lg" ref={previewRef}>
              <Card
                withBorder
                padding="lg"
                style={
                  sideBySide && previewHeight
                    ? { height: previewHeight, display: 'flex', flexDirection: 'column' }
                    : undefined
                }
              >
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
                    onChange={changePreviewValue}
                  />
                </ScrollArea>
              </Card>
              {/* Заключения растут естественно и прокручиваются вместе со страницей: своей прокрутки
                  у них нет, поэтому и обрывать их нечему. */}
              <AnalyzerResults result={previewResult} />
          </Stack>
        }
      />
    </Container>
  );
}
