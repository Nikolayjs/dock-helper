import { useState } from 'react';
import { Button, Group, Stack, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { LayoutEditor } from './LayoutEditor';
import { emptyLayout } from './layoutTypes';
import type { DocumentTemplate } from './templateTypes';
import type { DocumentTemplateInput } from './useDocumentTemplates';

/**
 * Editing a saved layout template. Mirrors DocumentTemplateForm's props so the editor page can pick
 * between the two by `kind` without knowing anything else about either.
 *
 * bodyHtml is passed through untouched rather than blanked: a template can in principle be switched
 * back to the flow editor, and silently discarding the other representation on every save would
 * make that a one-way door.
 */

interface LayoutTemplateFormProps {
  template: DocumentTemplate;
  onSubmit: (input: DocumentTemplateInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function LayoutTemplateForm({ template, onSubmit, onCancel, onDelete }: LayoutTemplateFormProps) {
  const [title, setTitle] = useState(template.title);
  const [layout, setLayout] = useState(template.layout ?? emptyLayout());

  const canSave = title.trim().length > 0;

  return (
    <Stack gap="lg">
      <TextInput
        label="Название документа"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
        maw={420}
      />

      <LayoutEditor layout={layout} onChange={setLayout} />

      <Group justify="space-between" mt="sm">
        {onDelete ? (
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
            Удалить
          </Button>
        ) : (
          <div />
        )}
        <Group>
          <Button variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button
            disabled={!canSave}
            onClick={() => onSubmit({ title: title.trim(), kind: 'layout', bodyHtml: template.bodyHtml, layout })}
          >
            Сохранить
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
