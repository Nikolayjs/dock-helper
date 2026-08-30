import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, TextInput, Textarea } from '@mantine/core';

import type { Abbreviation, AbbreviationInput } from './types';

/**
 * Добавление и правка записи — окном, а не отдельной страницей.
 *
 * У записи четыре коротких поля; страница ради них означала бы уход со списка и возврат обратно
 * ровно туда, где врач и так стоял. Карточка препарата — другое дело: там показания, дозы и
 * противопоказания, и они на экран списка не помещаются.
 */
interface Props {
  opened: boolean;
  /** Правка существующей записи или `null` — добавление новой. */
  editing: Abbreviation | null;
  sections: string[];
  onClose: () => void;
  onSubmit: (input: AbbreviationInput) => Promise<unknown>;
}

const EMPTY: AbbreviationInput = { short: '', full: '', meaning: '', origin: '', category: '' };

export function AbbreviationForm({ opened, editing, sections, onClose, onSubmit }: Props) {
  const [value, setValue] = useState<AbbreviationInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  // Поля заполняются при каждом открытии, а не один раз при создании компонента: окно живёт в
  // разметке постоянно, и без этого правка второй записи показала бы первую.
  useEffect(() => {
    if (!opened) return;
    setValue(
      editing
        ? {
            short: editing.short,
            full: editing.full,
            meaning: editing.meaning,
            origin: editing.origin,
            category: editing.category,
          }
        : EMPTY,
    );
  }, [opened, editing]);

  const set = <K extends keyof AbbreviationInput>(key: K, next: AbbreviationInput[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  // Сокращение и расшифровка обязательны: запись без одного из них — это не запись справочника.
  const canSave = value.short.trim() !== '' && value.full.trim() !== '' && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        short: value.short.trim(),
        full: value.full.trim(),
        meaning: value.meaning.trim(),
        origin: value.origin.trim(),
        category: value.category.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={editing ? 'Правка сокращения' : 'Новое сокращение'} centered>
      <Stack gap="sm">
        <TextInput
          label="Сокращение"
          placeholder="ХОБЛ"
          required
          value={value.short}
          onChange={(e) => set('short', e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Расшифровка"
          placeholder="хроническая обструктивная болезнь лёгких"
          required
          value={value.full}
          onChange={(e) => set('full', e.currentTarget.value)}
        />
        <TextInput
          label="Англоязычное соответствие"
          description="То, что стоит на импортном бланке или в зарубежной статье"
          placeholder="COPD"
          value={value.origin}
          onChange={(e) => set('origin', e.currentTarget.value)}
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
        <Textarea
          label="Пояснение"
          description="Где встречается, с чем не спутать. Одно-два предложения — подробности живут в рекомендациях"
          autosize
          minRows={2}
          maxRows={6}
          value={value.meaning}
          onChange={(e) => set('meaning', e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          {/* Кнопки нет смысла показывать активной, пока сохранять нечего: обещать сохранение и
              ничего не сохранить хуже, чем не обещать. */}
          <Button onClick={submit} disabled={!canSave} loading={saving}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
