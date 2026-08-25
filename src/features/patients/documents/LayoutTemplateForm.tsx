import { useState } from 'react';
import { Badge, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconPrinter, IconTrash } from '@tabler/icons-react';

import { LayoutEditor } from './LayoutEditor';
import { COPIES_PER_SHEET_OPTIONS, copiesPerSheet, emptyLayout, planSheet } from './layoutTypes';
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

  const copies = copiesPerSheet(layout);
  const plan = planSheet(layout, copies);
  // Spelled out because the orientation is chosen for the doctor, not by them — seeing "A4
  // альбомная" next to the count explains why the preview just turned sideways.
  const sheetSummary = `${plan.cols}×${plan.rows} на A4 ${plan.sheetWidthMm > plan.sheetHeightMm ? 'альбомной' : 'книжной'}, ${Math.round(plan.scale * 100)}%`;

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
        <Group justify="space-between" mb="xs" className="no-print" wrap="wrap" gap="sm">
          <Badge variant="light" color="gray">
            Предпросмотр (на примере пациента)
          </Badge>
          <Group gap="sm" wrap="wrap">
            <Select
              size="xs"
              w={150}
              aria-label="Копий на листе"
              data={COPIES_PER_SHEET_OPTIONS.map((n) => ({ value: String(n), label: `${n} на листе` }))}
              value={String(copies)}
              onChange={(value) => value && setLayout({ ...layout, copiesPerSheet: Number(value) })}
              allowDeselect={false}
            />
            <Text size="xs" c="dimmed">
              {sheetSummary}
            </Text>
            <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => window.print()}>
              Печать
            </Button>
          </Group>
        </Group>
        {/* A landscape A4 sheet is ~1120px at screen resolution and will outgrow the card on a
            laptop; scrolling the preview beats scaling it, which would misrepresent the print. */}
        <div style={{ overflowX: 'auto' }}>
          <div className="printable-document">
            <TemplateDocument template={previewTemplate} patient={SAMPLE_PATIENT} visit={SAMPLE_VISIT} />
          </div>
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
