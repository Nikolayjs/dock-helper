import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Container, Grid, Group, Loader, NumberInput, SegmentedControl, Tabs, Text } from '@mantine/core';

import { PageToolbar } from '../components/common/PageToolbar';
import { useUnsavedGuard } from '../components/common/unsavedChanges';
import { notifications } from '@mantine/notifications';
import { IconBuildingStore, IconClipboardPlus, IconEdit, IconEraser, IconFileUpload, IconPlus } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { STICKY_TOP } from '../layouts/shellMetrics';

import { analyzeTest } from '../features/analyzer/analyzerEngine';
import { usePatients } from '../features/patients/usePatients';
import { calcAge } from '../features/patients/utils';
import { AnalyzerResults } from '../features/analyzer/AnalyzerResults';
import { toLabTestDefinition } from '../features/analyzer/customTypes';
import { LabFileImportModal } from '../features/analyzer/import/LabFileImportModal';
import { toParamKey } from '../features/analyzer/import/paramKey';
import type { ParsedAnalyte } from '../features/analyzer/import/parseLabValues';
import { LabTestForm } from '../features/analyzer/LabTestForm';
import type { Sex } from '../features/analyzer/types';
import { useCustomAnalyzers } from '../features/analyzer/useCustomAnalyzers';
import { SaveToChartModal } from '../features/labResults/SaveToChartModal';
import { panelValues } from '../features/labResults/panels';
import type { FilledPanel } from '../features/labResults/panels';

export function AnalyzerPage() {
  const navigate = useNavigate();
  // Тот же порог, что у сетки колонок ниже: разъехавшись, они дали бы кадр прокрутки в одну колонку.
  const sideBySide = useMediaQuery('(min-width: 75em)', true, { getInitialValueInEffect: false });
  const { customTests, isLoading, updateTest } = useCustomAnalyzers();
  const allTests = useMemo(() => customTests.map(toLabTestDefinition), [customTests]);

  const [searchParams] = useSearchParams();
  const { patients } = usePatients();
  const patientId = searchParams.get('patientId');
  const patient = patientId ? patients.find((p) => p.id === patientId) : undefined;

  const [testId, setTestId] = useState<string | undefined>(undefined);
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState<number | undefined>(undefined);

  /**
   * Пол и возраст заполняются из карточки пациента — один раз, и дальше поля обычные.
   *
   * Без этого возрастные полосы норм не работали на практике: возраст надо было набирать руками, а
   * незаполненный означает взрослого. Поля остаются редактируемыми: анализ бывает принесён за
   * ребёнка, которого в картотеке нет, и подставленное значение не должно становиться приговором.
   *
   * Отметка `filledFor` держит id того пациента, для которого уже подставили: иначе правка возраста
   * откатывалась бы обратно на каждый рендер.
   */
  const filledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!patient || filledFor.current === patient.id) return;
    filledFor.current = patient.id;
    if (patient.sex) setSex(patient.sex);
    const patientAge = calcAge(patient.birthDate);
    if (patientAge !== null) setAge(patientAge);
  }, [patient]);
  const [valuesByTest, setValuesByTest] = useState<Record<string, Record<string, number | undefined>>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  /**
   * Набранные значения — это длинный ввод, и уходить с него молча нельзя.
   *
   * Страница специально держит **все** заполненные вкладки, а не открытую: файл из лаборатории
   * покрывает и общий анализ крови, и биохимию сразу. Значит, одним нажатием на пункт меню тут
   * теряются три десятка чисел, набранных руками с бумажного бланка. Охрана стоит в тринадцати
   * редакторах приложения; здесь был единственный длинный ввод без неё.
   *
   * Отметка о сохранённом — снимок того, что ушло в карту: после записи уходить можно свободно, а
   * дописанное после неё снова считается несохранённым.
   */
  const [savedMark, setSavedMark] = useState<string | null>(null);

  /**
   * Панели, в которых что-то набрано, — то, что вообще можно сохранить в карту.
   *
   * Считается по **всем** вкладкам, а не по открытой: файл из лаборатории обычно покрывает и общий
   * анализ крови, и биохимию сразу, и сохранение одной открытой вкладки потеряло бы остальные
   * молча — на экране в этот момент видна одна.
   */
  const filledPanels = useMemo<FilledPanel[]>(
    () =>
      allTests
        .map((test) => ({ test, values: valuesByTest[test.id] ?? {} }))
        .filter((panel) => panelValues(panel).length > 0),
    [allTests, valuesByTest],
  );

  /*
   * Открытая панель — состояние страницы, но ссылка снаружи вправе её назвать (`?test=<id>`).
   *
   * Иначе «Открыть» из магазина ведёт на страницу анализов и показывает **не то**, что врач только
   * что поставил, — обещание, которого ссылка не исполняет. Адрес читается один раз, как
   * происхождение у кнопки «назад»: дальше вкладки переключают руками, и переписывать за врачом
   * адрес на каждое нажатие незачем.
   */
  const requestedTestId = searchParams.get('test');
  const activeTestId = testId ?? (requestedTestId && allTests.some((t) => t.id === requestedTestId) ? requestedTestId : undefined) ?? allTests[0]?.id;
  const filledMark = useMemo(
    () => JSON.stringify(filledPanels.map((panel) => [panel.test.id, panelValues(panel)])),
    [filledPanels],
  );
  const guard = useUnsavedGuard(filledPanels.length > 0 && filledMark !== savedMark);

  const currentTest = allTests.find((t) => t.id === activeTestId);
  const currentValues = currentTest ? (valuesByTest[currentTest.id] ?? {}) : {};

  const handleChange = (key: string, value: number | undefined) => {
    if (!currentTest) return;
    setValuesByTest((prev) => ({ ...prev, [currentTest.id]: { ...prev[currentTest.id], [key]: value } }));
  };

  const handleClear = () => {
    if (!currentTest) return;
    setValuesByTest((prev) => ({ ...prev, [currentTest.id]: {} }));
  };

  /** Merges imported values in rather than replacing: a file rarely covers every parameter, and what
   *  the doctor already typed for the rest should survive the import. */
  const handleImport = (imported: Record<string, Record<string, number>>) => {
    setValuesByTest((prev) => {
      const next = { ...prev };
      for (const [id, values] of Object.entries(imported)) next[id] = { ...prev[id], ...values };
      return next;
    });
    const filled = Object.keys(imported);
    if (filled.length > 0) setTestId(filled[0]);
    const total = Object.values(imported).reduce((sum, values) => sum + Object.keys(values).length, 0);
    notifications.show({ message: `Подставлено показателей: ${total}`, color: 'teal' });
  };

  const handleCreateFromUnmatched = (analytes: ParsedAnalyte[]) => {
    navigate('/analyzer/new', { state: { seedAnalytes: analytes } });
  };

  /**
   * Adds analytes a file carried but the analyzer lacks, as new parameters on that analyzer.
   *
   * Name and unit come from the file; no reference range does. A laboratory prints intervals for
   * its own method and analyser, and adopting one silently would put a number the doctor never
   * chose in charge of what gets flagged — so a new parameter arrives with no range, flagging
   * nothing until they set one.
   */
  const handleExtendAnalyzer = async (testId: string, analytes: ParsedAnalyte[]) => {
    const test = customTests.find((t) => t.id === testId);
    if (!test) return allTests;

    const taken = new Set(test.parameters.map((p) => p.key));
    const added = analytes.map((analyte) => ({
      key: toParamKey(analyte.name, taken),
      label: analyte.name,
      unit: analyte.unit,
      inputType: 'number' as const,
      lowCauses: [],
      highCauses: [],
    }));

    const parameters = [...test.parameters, ...added];
    await updateTest(testId, {
      title: test.title,
      shortTitle: test.shortTitle,
      description: test.description,
      parameters,
      patterns: test.patterns,
    });
    notifications.show({ message: `Добавлено показателей: ${added.length}`, color: 'teal' });

    // Handed straight back to the modal so it can re-match without waiting for the refetch.
    return allTests.map((t) => (t.id === testId ? toLabTestDefinition({ ...test, parameters }) : t));
  };

  const result = useMemo(
    () => (currentTest ? analyzeTest(currentTest, currentValues, sex, age) : null),
    [currentTest, currentValues, sex, age],
  );

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <Container size="xl" px={0}>
      {/*
        Верхушка страницы — одна поверхность на три полосы управления, которые раньше висели на фоне
        по отдельности: вкладки анализов, кнопки раздела и параметры разбора. См. `PageToolbar`.
      */}
      <Box mb="lg">
        <PageToolbar
          tabs={
            <Group gap="xs" wrap="wrap">
              <Tabs value={activeTestId} onChange={(v) => setTestId(v ?? undefined)} variant="pills" style={{ minWidth: 0 }}>
                <Tabs.List>
                  {allTests.map((test) => (
                    <Tabs.Tab key={test.id} value={test.id}>
                      {test.shortTitle}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => navigate('/analyzer/new')}>
                Свой анализ
              </Button>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconBuildingStore size={14} />}
                onClick={() => navigate('/store?tab=analyzer')}
              >
                В магазин
              </Button>
              <Button size="xs" leftSection={<IconFileUpload size={14} />} onClick={() => setImportOpen(true)}>
                Загрузить файл
              </Button>
            </Group>
          }
        >
        <Group gap="md" wrap="wrap">
          <NumberInput
            value={age ?? ''}
            onChange={(v) => setAge(v === '' ? undefined : Number(v))}
            placeholder="Возраст, лет"
            min={0}
            max={120}
            w={140}
            radius="md"
          />
          <SegmentedControl
            value={sex}
            onChange={(v) => setSex(v as Sex)}
            data={[
              { value: 'male', label: 'Мужской' },
              { value: 'female', label: 'Женский' },
            ]}
          />
          {currentTest && (
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/analyzer/${currentTest.id}/edit`)}>
              Изменить
            </Button>
          )}
          {/* Разобранный анализ до этого жил в состоянии страницы и исчезал при первом же переходе:
              врач получал толкование, но не мог ни вернуться к нему завтра, ни сравнить с прошлым. */}
          <Button
            leftSection={<IconClipboardPlus size={16} />}
            onClick={() => setSaveOpen(true)}
            disabled={filledPanels.length === 0}
          >
            Сохранить в карту
          </Button>
          <Button variant="light" color="gray" leftSection={<IconEraser size={16} />} onClick={handleClear} disabled={!currentTest}>
            Очистить
          </Button>
        </Group>
        </PageToolbar>
      </Box>

      {currentTest && result && (
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card withBorder padding="lg">
              <Text fw={600} mb={2}>
                {currentTest.title}
              </Text>
              <Text size="sm" c="dimmed" mb="lg">
                {currentTest.description}
              </Text>
              <LabTestForm
                test={currentTest}
                sex={sex}
                age={age}
                values={currentValues}
                computedValues={result.values}
                statuses={result.statuses}
                onChange={handleChange}
              />
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 5 }}>
            {/*
              Прилипший кадр прокрутки — только там, где колонки стоят рядом.
              
              Пока они рядом, он и нужен: врач вписывает показатели слева и видит толкование справа,
              не прокручивая. Сложившись в одну колонку, тот же кадр становится вредом: заключения
              идут следом за формой, прокручивать внутри них нечего, а `overflow: auto` **режет
              карточку по своим краям** — растянутая во всю ширину, она обрезалась им до ширины
              колонки и получала снизу собственную полосу прокрутки (замер на 753 px: карточка
              заявлена на 0..753, нарисована на 20..733). Та же прилипшая прокрутка уже убиралась у
              конструкторов калькулятора и анкеты, и по той же причине.
            */}
            {sideBySide ? (
              <div
                className="app-sticky"
                style={{ position: 'sticky', top: `calc(${STICKY_TOP} + 16px)`, maxHeight: 'calc(100vh - 104px)', overflowY: 'auto' }}
              >
                <AnalyzerResults result={result} />
              </div>
            ) : (
              <AnalyzerResults result={result} />
            )}
          </Grid.Col>
        </Grid>
      )}

      {/* «Сохранить» в окне открывает запись в карту: она спрашивает пациента и дату, и сделать это
          за врача нечем. После записи страница перестаёт считаться несохранённой, и уйти можно. */}
      {guard.render({ onSave: () => setSaveOpen(true) })}

      <SaveToChartModal
        opened={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSaved={() => setSavedMark(filledMark)}
        panels={filledPanels}
        activeTestId={activeTestId}
        sex={sex}
        age={age}
        patientId={patientId}
      />

      <LabFileImportModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        tests={allTests}
        onApply={handleImport}
        onCreateAnalyzer={handleCreateFromUnmatched}
        onExtendAnalyzer={handleExtendAnalyzer}
      />
    </Container>
  );
}
