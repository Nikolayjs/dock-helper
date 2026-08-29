import { useRef, useState } from 'react';
import { ActionIcon, Button, Group, SegmentedControl, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCheck, IconPhoto, IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { RichTextEditor } from '@mantine/tiptap';

import { NOTE_COLORS } from './types';
import type { Note, NoteKind, TodoItem } from './types';
import type { NoteInput } from './useNotes';
import { EditorBubbleMenu } from '../../components/common/EditorBubbleMenu';
import { FormActions } from '../../components/common/FormActions';
import { useDirtyValue, useEditorDirty, useUnsavedGuard } from '../../components/common/unsavedChanges';
import { useSaveAction } from '../../components/common/useSaveAction';
import { STICKY_TOP } from '../../layouts/shellMetrics';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function emptyItem(): TodoItem {
  return { id: crypto.randomUUID(), text: '', done: false };
}

interface NoteFormProps {
  initialNote?: Note;
  initialDate?: string | null;
  onSubmit: (input: NoteInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  contentMinHeight?: number | string;
}

export function NoteForm({ initialNote, initialDate, onSubmit, onCancel, onDelete, contentMinHeight = 220 }: NoteFormProps) {
  const [kind, setKind] = useState<NoteKind>(initialNote?.kind ?? 'note');
  const [title, setTitle] = useState(initialNote?.title ?? '');
  const [items, setItems] = useState<TodoItem[]>(initialNote?.items ?? [emptyItem()]);
  const [pinnedDate, setPinnedDate] = useState<string | null>(initialNote?.pinnedDate ?? initialDate ?? null);
  const [color, setColor] = useState<string>(initialNote?.color ?? NOTE_COLORS[0]);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link, Image.configure({ allowBase64: true })],
    content: initialNote?.content ?? '',
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

  const fieldsDirty = useDirtyValue({ kind, title, items, pinnedDate, color });
  const textDirty = useEditorDirty(editor);
  const guard = useUnsavedGuard(fieldsDirty || textDirty);
  const { saving, save } = useSaveAction(guard, onSubmit);

  const handleSubmit = () => {
    if (!canSave) return;
    void save({
      kind,
      title: title.trim(),
      content: kind === 'note' ? (editor?.getHTML() ?? '') : '',
      items: kind === 'todo' ? items.filter((item) => item.text.trim()) : [],
      pinnedDate,
      color,
    });
  };

  return (
    <Stack gap="md">
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as NoteKind)}
        data={[
          { label: 'Заметка', value: 'note' },
          { label: 'Чек-лист', value: 'todo' },
        ]}
        fullWidth
      />

      <TextInput label="Заголовок" placeholder="Например: Позвонить пациенту" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />

      {kind === 'note' ? (
        <div>
          <Text size="sm" fw={500} mb={6}>
            Текст
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
      ) : (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Пункты списка
          </Text>
          {items.map((item, index) => (
            <Group key={item.id} gap={6} wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                placeholder={`Пункт ${index + 1}`}
                value={item.text}
                onChange={(e) => {
                  const text = e.currentTarget.value;
                  setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, text } : it)));
                }}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== item.id) : prev))}
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setItems((prev) => [...prev, emptyItem()])}>
            Добавить пункт
          </Button>
        </Stack>
      )}

      <DatePickerInput
        label="Закрепить за датой"
        placeholder="Без даты"
        value={pinnedDate}
        onChange={(v) => setPinnedDate(v as string | null)}
        clearable
        valueFormat="D MMMM YYYY"
      />

      <div>
        <Text size="sm" fw={500} mb={6}>
          Цвет
        </Text>
        <Group gap={8}>
          {NOTE_COLORS.map((c) => (
            <UnstyledButton
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                backgroundColor: `var(--mantine-color-${c}-6)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: color === c ? '2px solid var(--mantine-color-default-border)' : 'none',
                outlineOffset: 2,
              }}
            >
              {color === c && <IconCheck size={14} color="white" />}
            </UnstyledButton>
          ))}
        </Group>
      </div>

      {guard.render({ onSave: canSave ? handleSubmit : undefined })}

      <FormActions>
        <Group justify="space-between" mt="sm">
          {initialNote && onDelete ? (
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
