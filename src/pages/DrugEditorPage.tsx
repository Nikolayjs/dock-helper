import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Card, Container, Group, Select, Stack, TagsInput, Text, TextInput, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { drugGroups, normalizeDrugName } from '../features/drugs/drugIndex';
import { DRUG_TEXT_FIELDS, EMPTY_DRUG } from '../features/drugs/types';
import { useDrugCategories } from '../features/drugs/useDrugCategories';
import type { DrugInput } from '../features/drugs/types';
import { useDrug, useDrugs } from '../features/drugs/useDrugs';

export function DrugEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { drugs, createDrug, updateDrug } = useDrugs();
  // Форму заполняет полная карточка, а список рядом нужен только для проверки дубля МНН.
  const { drug: existing } = useDrug(id);
  const [form, setForm] = useState<DrugInput>(EMPTY_DRUG);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const { names: categoryNames, addCategory } = useDrugCategories();
  const [categorySearch, setCategorySearch] = useState('');

  /** Заводит раздел, которого ещё нет, прямо из выпадающего списка и сразу ставит его карточке. */
  const handleCreateCategory = async () => {
    const name = categorySearch.trim();
    if (!name) return;
    await addCategory(name);
    setForm((prev) => ({ ...prev, category: name }));
    setCategorySearch(name);
  };

  const groups = useMemo(() => drugGroups(drugs), [drugs]);

  useEffect(() => {
    // The list arrives asynchronously, so fill the form once the record shows up — and only once,
    // or every refetch would wipe out what the doctor has typed since.
    if (!existing || loadedId === existing.id) return;
    // Берём ровно поля формы, а не всё, что вернул сервер: запись несёт и служебные колонки
    // (workspaceId и прочее), а отправленные обратно они отвергаются валидацией целиком — форма
    // молча перестаёт сохраняться.
    setForm(
      Object.fromEntries(
        Object.keys(EMPTY_DRUG).map((key) => [key, existing[key as keyof typeof existing]]),
      ) as DrugInput,
    );
    setLoadedId(existing.id);
  }, [existing, loadedId]);

  /**
   * A second entry for the same МНН would split its interaction rules between two cards, so it is
   * blocked rather than merged — merging would have to guess which card's text to keep.
   */
  const duplicate = useMemo(() => {
    const inn = normalizeDrugName(form.inn);
    if (!inn) return null;
    return drugs.find((drug) => drug.id !== id && normalizeDrugName(drug.inn) === inn) ?? null;
  }, [drugs, form.inn, id]);

  const canSave = form.inn.trim() !== '' && !duplicate && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const payload: DrugInput = {
        ...form,
        inn: form.inn.trim(),
        brandNames: form.brandNames.map((name) => name.trim()).filter(Boolean),
        forms: form.forms.map((name) => name.trim()).filter(Boolean),
        pharmGroup: form.pharmGroup.trim(),
        atcCode: form.atcCode.trim().toUpperCase(),
      };
      if (id) {
        await updateDrug({ id, input: payload });
        notifications.show({ message: 'Препарат обновлён', color: 'teal' });
        navigate(`/drugs/${id}`);
      } else {
        const created = await createDrug(payload);
        notifications.show({ message: 'Препарат добавлен в справочник', color: 'teal' });
        navigate(`/drugs/${created.id}`);
      }
    } catch (error) {
      notifications.show({ message: error instanceof Error ? error.message : 'Не удалось сохранить', color: 'red' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Button component={Link} to={id ? `/drugs/${id}` : '/drugs'} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
            {id ? 'К карточке' : 'К справочнику'}
          </Button>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={isSaving} disabled={!canSave}>
            Сохранить
          </Button>
        </Group>

        <Title order={2}>{id ? 'Редактирование препарата' : 'Новый препарат'}</Title>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <TextInput
              label="МНН"
              description="Международное непатентованное название — им написаны правила взаимодействий"
              placeholder="Например: Ибупрофен"
              value={form.inn}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setForm((prev) => ({ ...prev, inn: value }));
              }}
              error={duplicate ? `«${duplicate.inn}» уже есть в справочнике` : undefined}
              required
            />

            <TagsInput
              label="Торговые названия"
              description="То, что написано на упаковке и что назовёт пациент. Enter — чтобы добавить"
              placeholder="Нурофен, Миг, Ибуклин…"
              value={form.brandNames}
              onChange={(value) => setForm((prev) => ({ ...prev, brandNames: value }))}
              clearable
            />

            <Select
              label="Раздел справочника"
              description="По нему препарат находится в списке — точную группу укажите ниже. Своего раздела нет? Впишите название и нажмите «+ Создать»"
              data={categoryNames}
              value={form.category || null}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value ?? '' }))}
              searchable
              clearable
              // Раздела, которого ещё нет, в списке не будет — поэтому его можно создать прямо
              // отсюда: иначе завести карточку в новом разделе можно было бы только через
              // отдельный экран, и это ровно то, чего раньше сделать было нельзя.
              nothingFoundMessage={
                <Button
                  size="compact-xs"
                  variant="light"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => void handleCreateCategory()}
                >
                  Создать раздел «{categorySearch.trim()}»
                </Button>
              }
              searchValue={categorySearch}
              onSearchChange={setCategorySearch}
            />

            <Group grow align="flex-start">
              <Autocomplete
                label="Фармакологическая группа"
                placeholder="Например: НПВС"
                data={groups}
                limit={20}
                value={form.pharmGroup}
                onChange={(value) => setForm((prev) => ({ ...prev, pharmGroup: value }))}
              />
              <TextInput
                label="Код ATC"
                placeholder="M01AE01"
                value={form.atcCode}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setForm((prev) => ({ ...prev, atcCode: value }));
                }}
              />
            </Group>

            <TagsInput
              label="Формы выпуска"
              placeholder="Таблетки 400 мг, суспензия…"
              value={form.forms}
              onChange={(value) => setForm((prev) => ({ ...prev, forms: value }))}
              clearable
            />
          </Stack>
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Заполняйте только то, что действительно нужно вам на приёме — пустые разделы в карточке не
              показываются.
            </Text>
            {DRUG_TEXT_FIELDS.map(({ key, label, placeholder }) => (
              <Textarea
                key={key}
                label={label}
                placeholder={placeholder}
                value={form[key] as string}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setForm((prev) => ({ ...prev, [key]: value }));
                }}
                autosize
                minRows={2}
              />
            ))}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
