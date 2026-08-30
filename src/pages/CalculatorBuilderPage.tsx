import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Container,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconDeviceFloppy,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';

import { CalculatorForm } from '../features/calculators/CalculatorForm';
import { FieldEditorRow, type DraftField } from '../features/calculators/builder/FieldEditorRow';
import { createDraftPreset, PresetEditorRow, type DraftPreset } from '../features/calculators/builder/PresetEditorRow';
import { RangeEditorRow } from '../features/calculators/builder/RangeEditorRow';
import {
  FORMULA_CONSTANT_NAMES,
  FORMULA_FUNCTION_NAMES,
  getFormulaVariables,
  parseFormula,
} from '../lib/formulaEngine';
import { CALCULATOR_CATEGORIES, type CalculatorDefinition, type InterpretationRange } from '../features/calculators/types';
import { QUERY_KEY as CALCULATORS_KEY, useCalculators } from '../features/calculators/useCalculators';
import { useCustomCategories } from '../features/calculators/useCustomCategories';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { BuilderLayout } from '../components/common/BuilderLayout';
import { FormActions } from '../components/common/FormActions';
import { useDirtyValue, useUnsavedGuard } from '../components/common/unsavedChanges';
import { useSaveAction } from '../components/common/useSaveAction';

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RESERVED_NAMES = new Set([...FORMULA_FUNCTION_NAMES, ...FORMULA_CONSTANT_NAMES]);

function emptyField(): DraftField {
  return { uid: crypto.randomUUID(), key: '', label: '', type: 'number' };
}


export function CalculatorBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { calculators, addCalculator, updateCalculator, deleteCalculator } = useCalculators();
  const confirmDelete = useDeleteWithConfirm();
  const { categories: customCategories, addCategory } = useCustomCategories();

  const editingCalculator = isEditMode ? calculators.find((calc) => calc.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(CALCULATOR_CATEGORIES[CALCULATOR_CATEGORIES.length - 1]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [fields, setFields] = useState<DraftField[]>([emptyField()]);
  const [formula, setFormula] = useState('');
  const [resultLabel, setResultLabel] = useState('Результат');
  const [resultUnit, setResultUnit] = useState('');
  const [decimals, setDecimals] = useState<number>(1);
  const [ranges, setRanges] = useState<InterpretationRange[]>([]);
  const [presets, setPresets] = useState<DraftPreset[]>([]);
  const [presetsLabel, setPresetsLabel] = useState('');
  const [hydrated, setHydrated] = useState(!isEditMode);

  useEffect(() => {
    if (editingCalculator && !hydrated) {
      setTitle(editingCalculator.title);
      setDescription(editingCalculator.description);
      setCategory(editingCalculator.category);
      setFields(editingCalculator.fields.map((field) => ({ ...field, uid: crypto.randomUUID() })));
      setFormula(editingCalculator.formula);
      setResultLabel(editingCalculator.resultLabel);
      setResultUnit(editingCalculator.resultUnit ?? '');
      setDecimals(editingCalculator.decimals);
      setRanges(editingCalculator.interpretation ?? []);
      setPresets((editingCalculator.presets ?? []).map((preset) => ({ ...preset, uid: crypto.randomUUID() })));
      setPresetsLabel(editingCalculator.presetsLabel ?? '');
      setHydrated(true);
    }
  }, [editingCalculator, hydrated]);

  const allCategories = useMemo(() => [...CALCULATOR_CATEGORIES, ...customCategories], [customCategories]);

  const handleAddCategory = async () => {
    const created = await addCategory(newCategoryName);
    if (!created) return;
    setCategory(created);
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const fieldKeys = fields.map((f) => f.key.trim()).filter(Boolean);

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push('Укажите название калькулятора.');
    if (fields.length === 0) list.push('Добавьте хотя бы одно поле ввода.');

    const seenKeys = new Set<string>();
    for (const field of fields) {
      const key = field.key.trim();
      if (!field.label.trim()) list.push('У каждого поля должно быть название.');
      if (!key) {
        list.push('У каждого поля должна быть переменная для формулы.');
      } else if (!IDENTIFIER_RE.test(key)) {
        list.push(`Переменная «${key}» недопустима: только латиница, цифры и «_», не начиная с цифры.`);
      } else if (RESERVED_NAMES.has(key)) {
        list.push(`Переменная «${key}» зарезервирована движком формул.`);
      } else if (seenKeys.has(key)) {
        list.push(`Переменная «${key}» используется дважды.`);
      }
      seenKeys.add(key);

      if (field.type === 'select' && !(field.options ?? []).some((o) => o.label.trim())) {
        list.push(`У поля «${field.label || key}» нужен хотя бы один вариант выбора.`);
      }
    }

    if (!formula.trim()) {
      list.push('Введите формулу расчёта.');
    } else {
      try {
        parseFormula(formula);
        const usedVars = getFormulaVariables(formula);
        const unknown = usedVars.filter((v) => !fieldKeys.includes(v));
        if (unknown.length > 0) {
          list.push(`Формула ссылается на неизвестные переменные: ${unknown.join(', ')}.`);
        }
      } catch (err) {
        list.push(err instanceof Error ? err.message : 'Формула содержит ошибку.');
      }
    }

    if (!resultLabel.trim()) list.push('Укажите название результата.');

    for (const preset of presets) {
      if (!preset.label.trim()) list.push('У каждого пресета должно быть название.');
    }

    return list;
  }, [title, fields, formula, fieldKeys, resultLabel, presets]);

  const previewDefinition: CalculatorDefinition = useMemo(
    () => ({
      id: 'preview',
      title: title || 'Новый калькулятор',
      description,
      category,
      fields: fields
        .filter((f) => f.key.trim())
        .map(({ uid: _uid, ...field }) => field),
      formula: formula || '0',
      resultLabel: resultLabel || 'Результат',
      resultUnit,
      decimals,
      interpretation: ranges.length > 0 ? ranges : undefined,
      presets: presets.length > 0 ? presets.map(({ uid: _uid, ...preset }) => preset) : undefined,
      presetsLabel: presetsLabel.trim() || undefined,
    }),
    [title, description, category, fields, formula, resultLabel, resultUnit, decimals, ranges, presets, presetsLabel],
  );

  const guard = useUnsavedGuard(
    useDirtyValue(
      { title, description, category, fields, formula, resultLabel, resultUnit, decimals, ranges, presets, presetsLabel },
      hydrated,
    ),
  );

  const { saving, save: handleSave } = useSaveAction(guard, async () => {
    if (errors.length > 0) return;

    if (editingCalculator) {
      const definition: CalculatorDefinition = { ...previewDefinition, id: editingCalculator.id, createdAt: editingCalculator.createdAt };
      await updateCalculator(definition);
      notifications.show({ message: 'Калькулятор обновлён', color: 'teal' });
      navigate(`/calculators/${definition.id}`);
    } else {
      const created = await addCalculator(previewDefinition);
      notifications.show({ message: 'Калькулятор создан', color: 'teal' });
      navigate(`/calculators/${created.id}`);
    }
  });

  const handleDelete = () => {
    if (!editingCalculator) return;
    confirmDelete({
      what: 'калькулятор',
      name: editingCalculator.title,
      notice: 'Калькулятор удалён',
      queryKey: CALCULATORS_KEY,
      id: editingCalculator.id,
      perform: () => deleteCalculator(editingCalculator.id),
      onConfirmed: () => navigate('/calculators'),
    });
  };

  return (
    <Container size="xl" px={0}>
      <Group justify="space-between" mb="lg">
        <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/calculators')}>
          К списку калькуляторов
        </Button>
        {editingCalculator && (
          <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
            Удалить
          </Button>
        )}
      </Group>

      <BuilderLayout
        editor={
          <>
            <Card withBorder padding="lg">
              <Title order={4} mb="md">
                Основное
              </Title>
              <Stack gap="md">
                <TextInput label="Название калькулятора" placeholder="Например: Индекс жировой массы" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
                <Textarea label="Описание" placeholder="Коротко: для чего этот калькулятор" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
                {isAddingCategory ? (
                  <Group gap={6} align="flex-end">
                    <TextInput
                      style={{ flex: 1 }}
                      label="Новая категория"
                      placeholder="Например: Гастроэнтерология"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                        if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewCategoryName('');
                        }
                      }}
                      autoFocus
                    />
                    <ActionIcon variant="light" color="teal" size="lg" onClick={handleAddCategory} aria-label="Сохранить категорию" disabled={!newCategoryName.trim()}>
                      <IconCheck size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="gray"
                      size="lg"
                      onClick={() => {
                        setIsAddingCategory(false);
                        setNewCategoryName('');
                      }}
                      aria-label="Отмена"
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                ) : (
                  <Group gap={6} align="flex-end">
                    <Select
                      style={{ flex: 1 }}
                      label="Категория"
                      data={allCategories}
                      value={category}
                      onChange={(v) => setCategory(v ?? CALCULATOR_CATEGORIES[0])}
                      allowDeselect={false}
                    />
                    <ActionIcon variant="light" size="lg" onClick={() => setIsAddingCategory(true)} aria-label="Добавить категорию">
                      <IconPlus size={16} />
                    </ActionIcon>
                  </Group>
                )}
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <Title order={4}>Поля ввода</Title>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setFields((prev) => [...prev, emptyField()])}>
                  Добавить поле
                </Button>
              </Group>
              <Stack gap="sm">
                {fields.map((field) => (
                  <FieldEditorRow
                    key={field.uid}
                    field={field}
                    onChange={(next) => setFields((prev) => prev.map((f) => (f.uid === next.uid ? next : f)))}
                    onRemove={() => setFields((prev) => prev.filter((f) => f.uid !== field.uid))}
                  />
                ))}
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Пресеты</Title>
                  <Text size="sm" c="dimmed">
                    Необязательно: готовые наборы значений для быстрого выбора — например, конкретный препарат с его дозировкой и концентрацией. Остальные поля пользователь заполняет сам.
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setPresets((prev) => [...prev, createDraftPreset()])}
                  disabled={fieldKeys.length === 0}
                >
                  Добавить пресет
                </Button>
              </Group>
              {presets.length > 0 && (
                <TextInput
                  label="Подпись селектора"
                  placeholder="Быстрый выбор"
                  description="Например: «Препарат» — как будет называться список пресетов на форме"
                  value={presetsLabel}
                  onChange={(e) => setPresetsLabel(e.currentTarget.value)}
                  mb="sm"
                />
              )}
              <Stack gap="sm">
                {presets.map((preset) => (
                  <PresetEditorRow
                    key={preset.uid}
                    preset={preset}
                    fields={fields}
                    onChange={(next) => setPresets((prev) => prev.map((p) => (p.uid === next.uid ? next : p)))}
                    onRemove={() => setPresets((prev) => prev.filter((p) => p.uid !== preset.uid))}
                  />
                ))}
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Title order={4} mb="xs">
                Формула
              </Title>
              <Text size="sm" c="dimmed" mb="sm">
                Переменные полей, операторы <Code>+ − * / % ^</Code>, сравнения{' '}
                <Code>{'< <= > >= = <>'}</Code> и функции: {FORMULA_FUNCTION_NAMES.join(', ')}.
              </Text>
              <Text size="sm" c="dimmed" mb="sm">
                Условие пишется как <Code>if(условие; если да; если нет)</Code> — например{' '}
                <Code>if(sex = 2; 0.85 * x; x)</Code> для поправки на пол. Несколько условий
                соединяются через <Code>and(…)</Code>, <Code>or(…)</Code> и <Code>not(…)</Code>.
                Десятичный разделитель — только точка; аргументы разделяются точкой с запятой или
                запятой.
              </Text>
              <Textarea
                placeholder="weight / ((height / 100) ^ 2)"
                value={formula}
                onChange={(e) => setFormula(e.currentTarget.value)}
                autosize
                minRows={2}
                styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
              />
              {fieldKeys.length > 0 && (
                <Group gap={6} mt="sm">
                  {fieldKeys.map((key) => (
                    <Badge
                      key={key}
                      variant="light"
                      color="gray"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setFormula((prev) => (prev ? `${prev} ${key}` : key))}
                    >
                      {key}
                    </Badge>
                  ))}
                </Group>
              )}

              <Divider my="md" />

              <Group grow>
                <TextInput label="Название результата" value={resultLabel} onChange={(e) => setResultLabel(e.currentTarget.value)} />
                <TextInput label="Единицы результата" value={resultUnit} onChange={(e) => setResultUnit(e.currentTarget.value)} />
                <NumberInput label="Знаков после запятой" min={0} max={4} value={decimals} onChange={(v) => setDecimals(Number(v) || 0)} />
              </Group>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Интерпретация результата</Title>
                  <Text size="sm" c="dimmed">
                    Необязательно: диапазоны значений с подписью (например, «Норма», «Ожирение»).
                  </Text>
                </div>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() =>
                    setRanges((prev) => [...prev, { id: crypto.randomUUID(), label: '', color: 'brand' }])
                  }
                >
                  Добавить диапазон
                </Button>
              </Group>
              <Stack gap="sm">
                {ranges.map((range) => (
                  <RangeEditorRow
                    key={range.id}
                    range={range}
                    onChange={(next) => setRanges((prev) => prev.map((r) => (r.id === next.id ? next : r)))}
                    onRemove={() => setRanges((prev) => prev.filter((r) => r.id !== range.id))}
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
          </>
        }
        actions={
          <FormActions>
            <Group justify="flex-end">
              <Button size="md" leftSection={<IconDeviceFloppy size={18} />} onClick={handleSave} loading={saving} disabled={errors.length > 0}>
                {editingCalculator ? 'Сохранить изменения' : 'Создать калькулятор'}
              </Button>
            </Group>
          </FormActions>
        }
        preview={
          /*
            Предпросмотр идёт естественной высотой и прокручивается вместе со страницей.

            Раньше он был прилипшим блоком со своей прокруткой (`maxHeight: calc(100vh - 104px)`), и
            это давало ровно те беды, что уже разобраны у анализатора: карточка обрезалась краем
            области прокрутки, родная полоса рисовалась справа от неё прямо на обоях, а низ уходил
            под прилипшую панель «Сохранить».
          */
          <Card withBorder padding="lg">
              <Badge variant="light" color="gray" mb="xs">
                Предпросмотр
              </Badge>
              <Title order={4} mb={4}>
                {previewDefinition.title}
              </Title>
              <Text size="sm" c="dimmed" mb="lg">
                {previewDefinition.description || 'Описание появится здесь'}
              </Text>
              <CalculatorForm definition={previewDefinition} />
          </Card>
        }
      />
    </Container>
  );
}
