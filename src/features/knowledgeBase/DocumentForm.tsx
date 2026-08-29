import { Button, Group, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import './editorContent.css';
import type { KnowledgeDocument } from './types';
import type { DocumentInput } from './useDocuments';
import { RichTextField } from '../../components/common/RichTextField';
import { useRichTextEditor } from '../../components/common/useRichTextEditor';
import { FormActions } from '../../components/common/FormActions';
import { useDirtyValue, useEditorDirty, useUnsavedGuard } from '../../components/common/unsavedChanges';
import { useSaveAction } from '../../components/common/useSaveAction';

export type DocumentFormInput = Omit<DocumentInput, 'kind' | 'author'>;

interface DocumentFormProps {
  initialDocument?: KnowledgeDocument;
  onSubmit: (input: DocumentFormInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  contentMinHeight?: number | string;
}

export function DocumentForm({ initialDocument, onSubmit, onCancel, onDelete, contentMinHeight = 220 }: DocumentFormProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [summary, setSummary] = useState(initialDocument?.summary ?? '');
  const [tags, setTags] = useState<string[]>(initialDocument?.tags ?? []);

  const editor = useRichTextEditor(initialDocument?.content ?? '');

  const canSave = title.trim().length > 0;

  const fieldsDirty = useDirtyValue({ title, summary, tags });
  const textDirty = useEditorDirty(editor);
  const guard = useUnsavedGuard(fieldsDirty || textDirty);
  const { saving, save } = useSaveAction(guard, onSubmit);

  const handleSubmit = () => {
    if (!canSave || !editor) return;
    void save({
      title: title.trim(),
      summary: summary.trim(),
      tags,
      content: editor.getHTML(),
    });
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Заголовок"
        placeholder="Название"
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
      />
      <Textarea
        label="Краткое описание"
        placeholder="Коротко о содержании — показывается в списке"
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
      />
      <TagsInput label="Теги" placeholder="Например: кардиология" value={tags} onChange={setTags} />

      <RichTextField
        editor={editor}
        minHeight={contentMinHeight}
        exportTitle={title}
        exportAuthor={initialDocument?.author}
        onImportedTitle={(imported) => {
          if (!title.trim()) setTitle(imported);
        }}
        hint={
          <Text size="xs" c="dimmed" mb={6}>
            Совет:{' '}
            <Text span ff="monospace">
              [[Название заметки]]
            </Text>{' '}
            создаёт связь — она появится на графе знаний
          </Text>
        }
      />

      {guard.render({ onSave: canSave ? handleSubmit : undefined })}

      <FormActions>
        <Group justify="space-between" mt="sm">
          {initialDocument && onDelete ? (
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
