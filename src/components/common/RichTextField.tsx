import { useRef, useState, type ReactNode } from 'react';
import { Button, Group, Menu, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconFileTypeDocx, IconPhoto, IconTable } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { RichTextEditor } from '@mantine/tiptap';

import { downloadDocx } from '../../lib/docx/downloadDocx';
import { readDocxFile } from '../../lib/docx/readDocx';
import { LEGACY_DOC_MESSAGE } from '../../lib/docx/wordFormat';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { fileToDataUrl } from './useRichTextEditor';
import { HEADER_HEIGHT } from '../../layouts/shellMetrics';

/**
 * Редактор текста со всем, что вокруг него: панель, всплывающее меню у выделения, вставка картинок
 * и таблиц, импорт из Word и выгрузка в Word.
 *
 * Живёт отдельно, потому что этим пользуются две разные сущности — статьи и рекомендации из базы
 * знаний и документы врача. Схема Tiptap у них обязана быть одна: `writeDocx` написан ровно под
 * неё, и редактор, умеющий что-то сверх, отдал бы в .docx документ с дырой на месте лишнего.
 */

interface RichTextFieldProps {
  editor: Editor | null;
  label?: string;
  hint?: ReactNode;
  minHeight?: number;
  /** Название и автор для выгружаемого .docx. */
  exportTitle: string;
  exportAuthor?: string;
  /** Заголовок, найденный в импортированном файле — форма решает, подставлять ли его. */
  onImportedTitle?: (title: string) => void;
}

export function RichTextField({
  editor,
  label = 'Текст',
  hint,
  minHeight = 220,
  exportTitle,
  exportAuthor,
  onImportedTitle,
}: RichTextFieldProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const insertImageFile = async (file: File) => {
    const src = await fileToDataUrl(file);
    editor?.chain().focus().setImage({ src }).run();
  };

  /**
   * Word внутрь. Пустой редактор заменяется, непустой получает документ по месту курсора: импорт не
   * должен быть способом потерять написанное.
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

      onImportedTitle?.(parsed.title || file.name.replace(/\.docx$/i, ''));

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
      await downloadDocx({ title: exportTitle.trim() || 'Документ', author: exportAuthor, html: editor.getHTML() });
    } catch {
      notifications.show({ message: 'Не удалось собрать файл .docx', color: 'red' });
    }
  };

  const runOnTable = (action: (chain: ReturnType<NonNullable<typeof editor>['chain']>) => unknown) => {
    if (editor) action(editor.chain().focus());
  };

  return (
    <div>
      <Group justify="space-between" mb={6} wrap="wrap" gap="xs">
        <Text size="sm" fw={500}>
          {label}
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
      {hint}

      <RichTextEditor editor={editor}>
        <EditorBubbleMenu editor={editor} />
        <RichTextEditor.Toolbar sticky stickyOffset={HEADER_HEIGHT}>
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
                <Menu.Item onClick={() => runOnTable((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
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
          mih={minHeight}
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
          // Сбрасывается, чтобы выбор того же файла второй раз подряд снова вызвал событие.
          e.currentTarget.value = '';
        }}
      />
    </div>
  );
}
