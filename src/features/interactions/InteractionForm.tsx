import { useState } from 'react';
import { Autocomplete, Button, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';

import { SEVERITY_OPTIONS, type InteractionSeverity } from './types';
import type { DrugInteractionInput } from './useDrugInteractions';

/**
 * The one place a new interaction rule is written.
 *
 * Extracted so a rule can be added from the drug being read about, not only from the check page.
 * Noticing that two drugs interact happens while looking at one of them, and having to leave the
 * page, open a modal somewhere else and retype the МНН is how a note never gets written down.
 */

export const EMPTY_INTERACTION: DrugInteractionInput = {
  drugA: '',
  drugB: '',
  severity: 'moderate',
  mechanism: '',
  recommendation: '',
};

interface InteractionFormProps {
  /** МНН to offer for completion — rules are written in МНН, never trade names. */
  innOptions: string[];
  /** Prefilled fields; the drug page pins the drug being read about as «Препарат А». */
  initial?: Partial<DrugInteractionInput>;
  onSubmit: (input: DrugInteractionInput) => Promise<unknown>;
  /** Runs only after a successful save — closing a modal, usually. */
  onSaved?: () => void;
}

export function InteractionForm({ innOptions, initial, onSubmit, onSaved }: InteractionFormProps) {
  const blank = { ...EMPTY_INTERACTION, ...initial };
  const [form, setForm] = useState<DrugInteractionInput>(blank);
  const [isSaving, setIsSaving] = useState(false);

  const isComplete =
    form.drugA.trim() !== '' &&
    form.drugB.trim() !== '' &&
    form.mechanism.trim() !== '' &&
    form.recommendation.trim() !== '';

  const handleSubmit = async () => {
    if (!isComplete) return;
    setIsSaving(true);
    try {
      await onSubmit({
        drugA: form.drugA.trim(),
        drugB: form.drugB.trim(),
        severity: form.severity,
        mechanism: form.mechanism.trim(),
        recommendation: form.recommendation.trim(),
      });
      // Back to blank rather than to what was typed: the next rule is a different pair, and the
      // pinned drug — if there is one — stays pinned.
      setForm(blank);
      notifications.show({ message: 'Взаимодействие добавлено', color: 'teal' });
      onSaved?.();
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Не удалось сохранить',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Указывайте МНН, а не торговое название: тогда правило сработает на любую упаковку из справочника.
      </Text>
      <Group grow>
        <Autocomplete
          label="Препарат А"
          placeholder="Например: Варфарин"
          data={innOptions}
          value={form.drugA}
          onChange={(value) => setForm((prev) => ({ ...prev, drugA: value }))}
          disabled={isSaving}
        />
        <Autocomplete
          label="Препарат Б"
          placeholder="Например: Ибупрофен"
          data={innOptions}
          value={form.drugB}
          onChange={(value) => setForm((prev) => ({ ...prev, drugB: value }))}
          disabled={isSaving}
        />
      </Group>
      <Select
        label="Серьёзность"
        data={SEVERITY_OPTIONS}
        value={form.severity}
        onChange={(v) => setForm((prev) => ({ ...prev, severity: (v as InteractionSeverity) ?? prev.severity }))}
        allowDeselect={false}
        disabled={isSaving}
      />
      <Textarea
        label="Механизм"
        placeholder="Почему это опасно"
        value={form.mechanism}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setForm((prev) => ({ ...prev, mechanism: value }));
        }}
        autosize
        minRows={2}
        disabled={isSaving}
      />
      <Textarea
        label="Рекомендация"
        placeholder="Что делать врачу"
        value={form.recommendation}
        onChange={(e) => {
          const value = e.currentTarget.value;
          setForm((prev) => ({ ...prev, recommendation: value }));
        }}
        autosize
        minRows={2}
        disabled={isSaving}
      />
      <Group justify="flex-end">
        <Button leftSection={<IconPlus size={16} />} onClick={handleSubmit} loading={isSaving} disabled={!isComplete}>
          Добавить
        </Button>
      </Group>
    </Stack>
  );
}
