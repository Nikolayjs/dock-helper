import { useState } from 'react';
import { Badge, Button, Card, Group, Stack, TextInput } from '@mantine/core';
import { IconPrinter, IconTrash } from '@tabler/icons-react';

import { LayoutEditor } from './LayoutEditor';
import { emptyLayout } from './layoutTypes';
import { SAMPLE_PATIENT, SAMPLE_VISIT } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';
import { TemplateDocument } from './TemplateDocument';
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

  const previewTemplate: DocumentTemplate = {
    id: 'preview',
    title,
    kind: 'layout',
    bodyHtml: template.bodyHtml,
    layout,
    createdAt: '',
    updatedAt: '',
  };

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

      <Card withBorder padding="lg">
        <Group justify="space-between" mb="xs" className="no-print">
          <Badge variant="light" color="gray">
            Предпросмотр (на примере пациента)
          </Badge>
          <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
            Печать
          </Button>
        </Group>
        <div className="printable-document">
          <TemplateDocument template={previewTemplate} patient={SAMPLE_PATIENT} visit={SAMPLE_VISIT} />
        </div>
      </Card>

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
