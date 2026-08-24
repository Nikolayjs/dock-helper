import { Badge, Button, Card, Group, Stack, Text, TextInput, Typography } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { Link } from '@tiptap/extension-link';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { RichTextEditor } from '@mantine/tiptap';
import { useState } from 'react';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';
import type { Patient, PatientVisit } from '../types';
import { PLACEHOLDERS, substitutePlaceholders } from './templateTypes';
import type { DocumentTemplate, TemplateContext } from './templateTypes';
import type { DocumentTemplateInput } from './useDocumentTemplates';

const SAMPLE_PATIENT: Patient = {
  id: 'sample',
  fullName: 'Иванов Иван Иванович',
  sex: 'male',
  birthDate: '1985-06-15',
  phone: '',
  reminderDate: null,
  reminderNote: '',
  visits: [],
  createdAt: '',
  updatedAt: '',
};

const SAMPLE_VISIT: PatientVisit = {
  id: 'sample',
  date: new Date().toISOString().slice(0, 10),
  diagnosis: 'Острый бронхит',
  diagnosisCode: 'J20',
  note: '',
  referralCategory: 'consultation',
  referralDestination: 'Пульмонолог',
  createdAt: '',
};

interface DocumentTemplateFormProps {
  initialTemplate?: DocumentTemplate;
  onSubmit: (input: DocumentTemplateInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function DocumentTemplateForm({ initialTemplate, onSubmit, onCancel, onDelete }: DocumentTemplateFormProps) {
  const user = useAuth();
  const [title, setTitle] = useState(initialTemplate?.title ?? '');

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: initialTemplate?.bodyHtml ?? '',
  });

  const canSave = title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({ title: title.trim(), bodyHtml: editor?.getHTML() ?? '' });
  };

  const previewContext: TemplateContext = {
    patient: SAMPLE_PATIENT,
    visit: SAMPLE_VISIT,
    doctorName: user.name,
    clinicSettings: getClinicSettings(),
  };
  const previewHtml = substitutePlaceholders(editor?.getHTML() ?? '', previewContext);

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
            <RichTextEditor.Toolbar sticky stickyOffset={0}>
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
        <Badge variant="light" color="gray" mb="xs">
          Предпросмотр (на примере пациента)
        </Badge>
        <Typography>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </Typography>
      </Card>

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
          <Button onClick={handleSubmit} disabled={!canSave}>
            Сохранить
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
