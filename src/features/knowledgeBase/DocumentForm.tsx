import { Button, Group, Menu, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconFileTypeDocx, IconPhoto, IconTable, IconTrash } from '@tabler/icons-react';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { RichTextEditor } from '@mantine/tiptap';
import { useRef, useState } from 'react';

import './editorContent.css';
import { downloadDocx } from '../../lib/docx/downloadDocx';
import { readDocxFile } from '../../lib/docx/readDocx';
import { LEGACY_DOC_MESSAGE } from '../../lib/docx/wordFormat';
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
  const wordInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image.configure({ allowBase64: true }),
      // Tables exist here for the sake of Word: a protocol or a dosing chart arrives as a table, and
      // a schema without one would drop it silently on import.
      TableKit.configure({ table: { resizable: true } }),
    ],
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

  /**
   * Word in, article out. An empty editor is replaced; one with text in it gets the document
   * inserted at the caret instead — importing must never be a way to lose what is already written.
   */
  const importWordFile = async (file: File) => {
    if (!editor) return;
    if (file.name.split('.').pop()?.toLowerCase() === 'doc') {
      notifications.show({ message: LEGACY_DOC_MESSAGE, color: 'red', autoClose: 12_000 });
      return;
    }

    setImporting(true);
    try {
      const parsed = await readDocxFile(file);
      if (editor.isEmpty) editor.commands.setContent(parsed.html);
      else editor.chain().focus().insertContent(parsed.html).run();

      if (!title.trim()) setTitle(parsed.title || file.name.replace(/\.docx$/i, ''));

      notifications.show({
        message: parsed.warnings.length
          ? `Документ перенесён. Кое-что перенести не удалось (${parsed.warnings.length}) — пролистайте текст и проверьте.`
          : 'Документ перенесён в редактор',
        color: parsed.warnings.length ? 'yellow' : 'teal',
      });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Не удалось прочитать файл Word',
        color: 'red',
        autoClose: 12_000,
      });
    } finally {
      setImporting(false);
    }
  };

  const exportWord = async () => {
    if (!editor) return;
    try {
      await downloadDocx({
        title: title.trim() || 'Документ',
        author: initialDocument?.author,
        html: editor.getHTML(),
      });
    } catch {
      notifications.show({ message: 'Не удалось собрать файл .docx', color: 'red' });
    }
  };

  const runOnTable = (action: (chain: ReturnType<NonNullable<typeof editor>['chain']>) => unknown) => {
    if (editor) action(editor.chain().focus());
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
        <Group justify="space-between" mb={6} wrap="wrap" gap="xs">
          <Text size="sm" fw={500}>
            Текст
          </Text>
          <Group gap="xs">
            <Button
              size="compact-xs"
              variant="light"
              leftSection={<IconFileTypeDocx size={14} />}
              loading={importing}
              onClick={() => wordInputRef.current?.click()}
            >
              Импорт из Word
            </Button>
            <Button size="compact-xs" variant="subtle" leftSection={<IconDownload size={14} />} onClick={() => void exportWord()}>
              Скачать .docx
            </Button>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" mb={6}>
          Совет: <Text span ff="monospace">[[Название заметки]]</Text> создаёт связь — она появится на графе знаний
        </Text>
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

              <Menu shadow="md" position="bottom-start">
                <Menu.Target>
                  <RichTextEditor.Control aria-label="Таблица" title="Таблица">
                    <IconTable size={16} stroke={1.5} />
                  </RichTextEditor.Control>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    onClick={() => runOnTable((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
                  >
                    Вставить таблицу 3 × 3
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item onClick={() => runOnTable((chain) => chain.addRowAfter().run())}>Строка ниже</Menu.Item>
                  <Menu.Item onClick={() => runOnTable((chain) => chain.addColumnAfter().run())}>Столбец справа</Menu.Item>
                  <Menu.Item onClick={() => runOnTable((chain) => chain.deleteRow().run())}>Удалить строку</Menu.Item>
                  <Menu.Item onClick={() => runOnTable((chain) => chain.deleteColumn().run())}>Удалить столбец</Menu.Item>
                  <Menu.Item onClick={() => runOnTable((chain) => chain.mergeOrSplit().run())}>Объединить / разделить</Menu.Item>
                  <Menu.Divider />
                  <Menu.Item color="red" onClick={() => runOnTable((chain) => chain.deleteTable().run())}>
                    Удалить таблицу
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
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
        <input
          ref={wordInputRef}
          type="file"
          accept=".doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) void importWordFile(file);
            // Cleared so picking the same file twice in a row still fires a change event.
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
