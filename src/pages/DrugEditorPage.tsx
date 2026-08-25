import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Card, Container, Group, Select, Stack, TagsInput, Text, TextInput, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { drugGroups, normalizeDrugName } from '../features/drugs/drugIndex';
import { DRUG_CATEGORIES, DRUG_TEXT_FIELDS, EMPTY_DRUG } from '../features/drugs/types';
import type { DrugInput } from '../features/drugs/types';
import { useDrugs } from '../features/drugs/useDrugs';

export function DrugEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { drugs, createDrug, updateDrug } = useDrugs();
  const [form, setForm] = useState<DrugInput>(EMPTY_DRUG);
  const [isSaving, setIsSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const existing = id ? drugs.find((drug) => drug.id === id) : undefined;
  const groups = useMemo(() => drugGroups(drugs), [drugs]);

  useEffect(() => {
    // The list arrives asynchronously, so fill the form once the record shows up — and only once,
    // or every refetch would wipe out what the doctor has typed since.
    if (!existing || loadedId === existing.id) return;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing;
    setForm(rest);
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
              description="По нему препарат находится в списке — точную группу укажите ниже"
              data={DRUG_CATEGORIES}
              value={form.category || null}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value ?? '' }))}
              searchable
              clearable
            />

            <Group grow align="flex-start">
              <Autocomplete
                label="Фармакологическая группа"
                placeholder="Например: НПВС"
                data={groups}
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
