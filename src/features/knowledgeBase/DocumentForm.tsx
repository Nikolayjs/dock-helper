import { Button, Group, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { IconPhoto, IconTrash } from '@tabler/icons-react';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { RichTextEditor } from '@mantine/tiptap';
import { useRef, useState } from 'react';

import type { KnowledgeDocument } from './types';
import type { DocumentInput } from './useDocuments';

export type DocumentFormInput = Omit<DocumentInput, 'kind' | 'author'>;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface DocumentFormProps {
  initialDocument?: KnowledgeDocument;
  onSubmit: (input: DocumentFormInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
  contentMinHeight?: number;
}

export function DocumentForm({ initialDocument, onSubmit, onCancel, onDelete, contentMinHeight = 220 }: DocumentFormProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [summary, setSummary] = useState(initialDocument?.summary ?? '');
  const [tags, setTags] = useState<string[]>(initialDocument?.tags ?? []);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link, Image.configure({ allowBase64: true })],
    content: initialDocument?.content ?? '',
    editorProps: {
      handlePaste: (view, event) => {
        const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
        const file = imageItem?.getAsFile();
        if (!file) return false;
        event.preventDefault();
        void fileToDataUrl(file).then((src) => {
          const node = view.state.schema.nodes.image.create({ src });
          view.dispatch(view.state.tr.replaceSelectionWith(node));
        });
        return true;
      },
    },
  });

  const insertImageFile = async (file: File) => {
    const src = await fileToDataUrl(file);
    editor?.chain().focus().setImage({ src }).run();
  };

  const canSave = title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave || !editor) return;
    onSubmit({
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

      <div>
        <Group justify="space-between" mb={6}>
          <Text size="sm" fw={500}>
            Текст
          </Text>
          <Text size="xs" c="dimmed">
            Совет: <Text span ff="monospace">[[Название заметки]]</Text> создаёт связь — она появится на графе знаний
          </Text>
        </Group>
        <RichTextEditor editor={editor}>
          <RichTextEditor.Toolbar sticky stickyOffset={0}>
            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Bold />
              <RichTextEditor.Italic />
              <RichTextEditor.Underline />
              <RichTextEditor.Strikethrough />
              <RichTextEditor.ClearFormatting />
              <RichTextEditor.Code />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.H2 />
              <RichTextEditor.H3 />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Blockquote />
              <RichTextEditor.BulletList />
              <RichTextEditor.OrderedList />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Link />
              <RichTextEditor.Unlink />
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Control
                onClick={() => imageInputRef.current?.click()}
                aria-label="Вставить изображение"
                title="Вставить изображение"
              >
                <IconPhoto size={16} stroke={1.5} />
              </RichTextEditor.Control>
            </RichTextEditor.ControlsGroup>

            <RichTextEditor.ControlsGroup>
              <RichTextEditor.Undo />
              <RichTextEditor.Redo />
            </RichTextEditor.ControlsGroup>
          </RichTextEditor.Toolbar>
          <RichTextEditor.Content
            mih={contentMinHeight}
            style={{ cursor: 'text' }}
            onClick={(event) => {
              if (event.target === event.currentTarget) editor?.commands.focus('end');
            }}
          />
        </RichTextEditor>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void insertImageFile(file);
            e.currentTarget.value = '';
          }}
        />
      </div>

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
          <Button onClick={handleSubmit} disabled={!canSave}>
            Сохранить
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
