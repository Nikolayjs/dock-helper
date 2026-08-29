import { Badge, Button, Card, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconPrinter, IconTrash } from '@tabler/icons-react';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { RichTextEditor } from '@mantine/tiptap';
import { useState } from 'react';

import { PLACEHOLDERS, SAMPLE_PATIENT, SAMPLE_VISIT } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';
import { TemplateDocument } from './TemplateDocument';
import type { DocumentTemplateInput } from './useDocumentTemplates';
import { EditorBubbleMenu } from '../../../components/common/EditorBubbleMenu';
import { FormActions } from '../../../components/common/FormActions';
import { useDirtyValue, useEditorDirty, useUnsavedGuard } from '../../../components/common/unsavedChanges';
import { useSaveAction } from '../../../components/common/useSaveAction';
import { STICKY_TOP } from '../../../layouts/shellMetrics';

interface DocumentTemplateFormProps {
  initialTemplate?: DocumentTemplate;
  onSubmit: (input: DocumentTemplateInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function DocumentTemplateForm({ initialTemplate, onSubmit, onCancel, onDelete }: DocumentTemplateFormProps) {
  const [title, setTitle] = useState(initialTemplate?.title ?? '');

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: initialTemplate?.bodyHtml ?? '',
  });

  const canSave = title.trim().length > 0;

  const titleDirty = useDirtyValue({ title });
  const bodyDirty = useEditorDirty(editor);
  const guard = useUnsavedGuard(titleDirty || bodyDirty);
  const { saving, save } = useSaveAction(guard, onSubmit);

  const handleSubmit = () => {
    if (!canSave) return;
    void save({ title: title.trim(), bodyHtml: editor?.getHTML() ?? '' });
  };

  const previewTemplate: DocumentTemplate = {
    id: 'preview',
    title,
    kind: 'flow',
    bodyHtml: editor?.getHTML() ?? '',
    layout: null,
    createdAt: '',
    updatedAt: '',
  };

  return (
    <Stack gap="lg">
      <Stack gap="md">
        <TextInput
          label="Название документа"
          placeholder="Например: Больничный лист"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />

        <div>
          <Text size="sm" fw={500} mb={6}>
            Текст документа
          </Text>
          <RichTextEditor editor={editor}>
          <EditorBubbleMenu editor={editor} />
            <RichTextEditor.Toolbar sticky stickyOffset={STICKY_TOP}>
              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Bold />
                <RichTextEditor.Italic />
                <RichTextEditor.Underline />
                <RichTextEditor.Strikethrough />
                <RichTextEditor.ClearFormatting />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.H2 />
                <RichTextEditor.H3 />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.AlignLeft />
                <RichTextEditor.AlignCenter />
                <RichTextEditor.AlignRight />
                <RichTextEditor.AlignJustify />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.BulletList />
                <RichTextEditor.OrderedList />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Link />
                <RichTextEditor.Unlink />
              </RichTextEditor.ControlsGroup>

              <RichTextEditor.ControlsGroup>
                <RichTextEditor.Undo />
                <RichTextEditor.Redo />
              </RichTextEditor.ControlsGroup>
            </RichTextEditor.Toolbar>
            <RichTextEditor.Content
              mih={200}
              style={{ cursor: 'text' }}
              onClick={(event) => {
                if (event.target === event.currentTarget) editor?.commands.focus('end');
              }}
            />
          </RichTextEditor>
        </div>

        <div>
          <Text size="sm" fw={500} mb={6}>
            Вставить в текст
          </Text>
          <Group gap={6}>
            {PLACEHOLDERS.map((placeholder) => (
              <Badge
                key={placeholder.token}
                variant="light"
                color="gray"
                style={{ cursor: 'pointer' }}
                onClick={() => editor?.chain().focus().insertContent(placeholder.token).run()}
              >
                {placeholder.label}
              </Badge>
            ))}
          </Group>
        </div>
      </Stack>

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

      {guard.render({ onSave: canSave ? handleSubmit : undefined })}

      <FormActions>
        <Group justify="space-between" mt="sm">
          {initialTemplate && onDelete ? (
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
            <Button onClick={handleSubmit} loading={saving} disabled={!canSave}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </FormActions>
    </Stack>
  );
}
