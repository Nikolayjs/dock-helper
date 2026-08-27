import { useRef, useState, type ReactNode } from 'react';
import { Button, ColorSwatch, Group, Menu, Select, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconFileTypeDocx, IconHighlight, IconPageBreak, IconPhoto, IconTable } from '@tabler/icons-react';
import { useEditorState, type Editor } from '@tiptap/react';
import { RichTextEditor } from '@mantine/tiptap';

import { downloadDocx } from '../../lib/docx/downloadDocx';
import { readDocxFile } from '../../lib/docx/readDocx';
import { LEGACY_DOC_MESSAGE } from '../../lib/docx/wordFormat';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { RUSSIAN_EDITOR_LABELS } from './editorLabels';
import { FONT_FAMILIES, FONT_SIZES, fileToDataUrl } from './useRichTextEditor';
import { HEADER_HEIGHT } from '../../layouts/shellMetrics';

/** Русское склонение счётчика: «1 слово», «2 слова», «5 слов». */
function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = count % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Цвета текста: тёмные, читаемые на белом листе. Красный — для «внимание», а не для украшения. */
const TEXT_COLORS = ['#212529', '#c92a2a', '#a61e4d', '#5f3dc4', '#1864ab', '#2b8a3e', '#e67700'];

/**
 * Палитра маркера — ровно те цвета, для которых у Word есть **своё имя** выделения.
 *
 * `w:highlight` принимает только именованные цвета; произвольный пришлось бы отдавать заливкой, а
 * она в Word ведёт себя как фон абзаца, а не как маркер. Список сверяется с HIGHLIGHT_TO_WORD в
 * `writeDocx`, и расширять его в одиночку нельзя.
 */
const HIGHLIGHT_COLORS: { color: string; label: string }[] = [
  { color: '#ffec99', label: 'Жёлтый' },
  { color: '#b2f2bb', label: 'Зелёный' },
  { color: '#99e9f2', label: 'Голубой' },
  { color: '#a5d8ff', label: 'Синий' },
  { color: '#ffc9c9', label: 'Розовый' },
  { color: '#eebefa', label: 'Сиреневый' },
];

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
  minHeight?: number | string;
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
  const [highlightOpen, setHighlightOpen] = useState(false);

  /**
   * Гарнитура и кегль под курсором.
   *
   * Через `useEditorState`, а не через `editor.getAttributes` в рендере: кнопки панели Mantine
   * следят за состоянием сами, а свои поля выбора иначе показывали бы то, что было при последней
   * перерисовке, — то есть врали бы при переходе между абзацами разного шрифта.
   */
  const textStyle = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const attributes = current?.getAttributes('textStyle') ?? {};
      return {
        fontFamily: (attributes.fontFamily as string | undefined) ?? null,
        fontSize: (attributes.fontSize as string | undefined) ?? null,
      };
    },
  }) ?? { fontFamily: null, fontSize: null };

  /** Счётчик слов — то, о чём в Word спрашивают чаще всего, и то, чего здесь до сих пор не было. */
  const counts = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      words: (current?.storage.characterCount as { words?: () => number } | undefined)?.words?.() ?? 0,
      characters: (current?.storage.characterCount as { characters?: () => number } | undefined)?.characters?.() ?? 0,
    }),
  }) ?? { words: 0, characters: 0 };

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

      <RichTextEditor editor={editor} labels={RUSSIAN_EDITOR_LABELS}>
        <EditorBubbleMenu editor={editor} />
        <RichTextEditor.Toolbar sticky stickyOffset={HEADER_HEIGHT}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <Select
              size="xs"
              w={150}
              aria-label="Гарнитура"
              placeholder="Шрифт"
              data={FONT_FAMILIES}
              value={textStyle.fontFamily}
              onChange={(family) =>
                family
                  ? editor?.chain().focus().setFontFamily(family).run()
                  : editor?.chain().focus().unsetFontFamily().run()
              }
              clearable
              comboboxProps={{ withinPortal: true }}
            />
            <Select
              size="xs"
              w={82}
              aria-label="Кегль"
              placeholder="Кегль"
              data={FONT_SIZES}
              value={textStyle.fontSize}
              onChange={(size) =>
                size ? editor?.chain().focus().setFontSize(size).run() : editor?.chain().focus().unsetFontSize().run()
              }
              clearable
              comboboxProps={{ withinPortal: true }}
            />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.Subscript />
            <RichTextEditor.Superscript />
            <RichTextEditor.Code />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.ColorPicker colors={TEXT_COLORS} />
            <RichTextEditor.UnsetColor />
            {/* Меню закрывается вручную: образцы цвета — обычные кнопки, а не пункты меню, и без
                этого список оставался бы открытым поверх текста, перехватывая следующее нажатие. */}
            <Menu shadow="md" position="bottom-start" withinPortal opened={highlightOpen} onChange={setHighlightOpen}>
              <Menu.Target>
                <RichTextEditor.Control aria-label="Маркер" title="Выделить маркером">
                  <IconHighlight size={16} stroke={1.5} />
                </RichTextEditor.Control>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Маркер</Menu.Label>
                <Group gap={6} px="xs" pb={6}>
                  {HIGHLIGHT_COLORS.map(({ color, label: name }) => (
                    <Tooltip key={color} label={name} withArrow>
                      <ColorSwatch
                        component="button"
                        color={color}
                        size={22}
                        style={{ cursor: 'pointer' }}
                        aria-label={name}
                        onClick={() => {
                          editor?.chain().focus().toggleHighlight({ color }).run();
                          setHighlightOpen(false);
                        }}
                      />
                    </Tooltip>
                  ))}
                </Group>
                <Menu.Divider />
                <Menu.Item onClick={() => editor?.chain().focus().unsetHighlight().run()}>Убрать маркер</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H1 />
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
            <RichTextEditor.TaskList />
            <RichTextEditor.TaskListSink />
            <RichTextEditor.TaskListLift />
          </RichTextEditor.ControlsGroup>

          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Blockquote />
            <RichTextEditor.CodeBlock />
            <RichTextEditor.Hr />
            <RichTextEditor.Control
              onClick={() => editor?.chain().focus().insertContent({ type: 'pageBreak' }).run()}
              aria-label="Разрыв страницы"
              title="Разрыв страницы — дальше начнётся новый лист"
            >
              <IconPageBreak size={16} stroke={1.5} />
            </RichTextEditor.Control>
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
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content
          mih={minHeight}
          style={{ cursor: 'text' }}
          onClick={(event) => {
            if (event.target === event.currentTarget) editor?.commands.focus('end');
          }}
        />
      </RichTextEditor>

      <Group justify="space-between" mt={6} gap="xs" wrap="wrap">
        <Text size="xs" c="dimmed">
          Выделите текст — инструменты придут к нему сами
        </Text>
        <Text size="xs" c="dimmed">
          {counts.words} {plural(counts.words, 'слово', 'слова', 'слов')} · {counts.characters}{' '}
          {plural(counts.characters, 'знак', 'знака', 'знаков')}
        </Text>
      </Group>

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
