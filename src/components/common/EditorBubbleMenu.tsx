import { Divider, Group, Paper } from '@mantine/core';
import { RichTextEditor } from '@mantine/tiptap';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

/**
 * Панель форматирования, всплывающая у выделенного текста.
 *
 * Верхняя панель остаётся — она видна сразу и показывает, что вообще умеет редактор. Но добраться до
 * неё из середины длинной статьи значило прокрутить страницу вверх, отформатировать слово и вернуться
 * обратно. Здесь инструменты приходят к тексту, а не текст к инструментам.
 *
 * Набор намеренно короче верхней панели: всплывающая полоса конкурирует за место с самим текстом, и
 * в неё попало то, что применяют к **выделенному куску** — начертания, заголовок, список, ссылка.
 * Вставка картинки и таблицы относятся к месту курсора, а не к выделению, и остались наверху.
 */
export function EditorBubbleMenu({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: current, from, to }) =>
        // Пустое выделение — это просто курсор, и предлагать ему нечего. В блоке кода
        // форматирование не применяется, там панель только мешала бы.
        from !== to && !current.isActive('codeBlock')
      }
    >
      <Paper withBorder shadow="md" radius="md" p={4}>
        <Group gap={2} wrap="nowrap">
          <RichTextEditor.Bold />
          <RichTextEditor.Italic />
          <RichTextEditor.Underline />
          <RichTextEditor.Strikethrough />
          <RichTextEditor.Code />

          <Divider orientation="vertical" mx={2} />

          <RichTextEditor.H2 />
          <RichTextEditor.H3 />
          <RichTextEditor.BulletList />
          <RichTextEditor.OrderedList />

          <Divider orientation="vertical" mx={2} />

          <RichTextEditor.Link />
          <RichTextEditor.Unlink />
          <RichTextEditor.ClearFormatting />
        </Group>
      </Paper>
    </BubbleMenu>
  );
}
