import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, TagsInput, TextInput, Textarea } from '@mantine/core';

import type { Disease, DiseaseInput } from './types';

/**
 * Добавление и правка нозологии.
 *
 * Описание здесь — обычная многострочная запись, а не редактор с оформлением: карточка болезни
 * отвечает «что это, каким кодом кодируется и где читать подробно», а подробно пишется в
 * клинической рекомендации, у которой для этого есть настоящий редактор. Второй такой же здесь
 * означал бы два места для одного текста.
 */
interface Props {
  opened: boolean;
  editing: Disease | null;
  sections: string[];
  onClose: () => void;
  onSubmit: (input: DiseaseInput) => Promise<unknown>;
}

const EMPTY: DiseaseInput = { name: '', synonyms: [], icdCodes: [], summary: '', description: '', category: '' };

export function DiseaseForm({ opened, editing, sections, onClose, onSubmit }: Props) {
  const [value, setValue] = useState<DiseaseInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setValue(
      editing
        ? {
            name: editing.name,
            synonyms: editing.synonyms,
            icdCodes: editing.icdCodes,
            summary: editing.summary,
            description: editing.description,
            category: editing.category,
          }
        : EMPTY,
    );
  }, [opened, editing]);

  const set = <K extends keyof DiseaseInput>(key: K, next: DiseaseInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const canSave = value.name.trim() !== '' && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        name: value.name.trim(),
        synonyms: value.synonyms.map((s) => s.trim()).filter(Boolean),
        // Коды приводятся к верхнему регистру: врач наберёт «i21», а ссылка на карточку кода
        // собирается из этой самой строки.
        icdCodes: value.icdCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
        summary: value.summary.trim(),
        description: value.description.trim(),
        category: value.category.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Правка заболевания' : 'Новое заболевание'} centered size="lg">
      <Stack gap="sm">
        <TextInput
          label="Название"
          placeholder="Хронический бронхит"
          required
          value={value.name}
          onChange={(e) => set('name', e.currentTarget.value)}
          data-autofocus
        />
        <TagsInput
          label="Синонимы"
          description="Прежнее название, разговорное, аббревиатура — то, как болезнь называют"
          placeholder="Enter — добавить"
          value={value.synonyms}
          onChange={(next) => set('synonyms', next)}
        />
        <TagsInput
          label="Коды МКБ-10"
          description="Можно несколько: болезнь часто кодируется группой рубрик"
          placeholder="J41, J42"
          value={value.icdCodes}
          onChange={(next) => set('icdCodes', next)}
        />
        <Select
          label="Раздел"
          placeholder="без раздела"
          data={sections}
          value={value.category || null}
          onChange={(next) => set('category', next ?? '')}
          searchable
          clearable
          allowDeselect={false}
        />
        <TextInput
          label="Суть"
          description="Одна строка: что это. Видна в списке"
          value={value.summary}
          onChange={(e) => set('summary', e.currentTarget.value)}
        />
        <Textarea
          label="Описание"
          description="То, что вы хотите помнить про эту болезнь. Обновления справочника его не затирают"
          autosize
          minRows={4}
          maxRows={16}
          value={value.description}
          onChange={(e) => set('description', e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={!canSave} loading={saving}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
