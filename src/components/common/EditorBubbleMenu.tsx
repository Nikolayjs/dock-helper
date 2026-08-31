import { Divider, Group, Paper } from '@mantine/core';
import { RichTextEditor } from '@mantine/tiptap';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';

import { HEADER_HEIGHT } from '../../layouts/shellMetrics';

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
      /*
       * Панель встаёт над выделением, а на верхних строках — под ним.
       *
       * Прилипшая панель инструментов стоит у верхнего края области прокрутки, и всплывающая полоса
       * ложилась ровно на неё: выделив слово в первой строке, врач переставал попадать по кнопкам
       * наверху — нажатие уходило в панель, которой он не звал. Найдено прогоном: клик по кнопке
       * панели инструментов перехватывался всплывающей.
       *
       * `flip` с верхним отступом объявляет верхнюю полосу экрана занятой, и floating-ui сам
       * переносит панель под выделение. Отступ — высота шапки плюс высота панели инструментов с
       * запасом; точнее считать незачем: ниже выделения панель ведёт себя так же хорошо.
       */
      options={{ placement: 'top', offset: 8, flip: { padding: { top: HEADER_HEIGHT + 48 } } }}
      shouldShow={({ editor: current, from, to }) =>
        // Пустое выделение — это просто курсор, и предлагать ему нечего. В блоке кода
        // форматирование не применяется, там панель только мешала бы. Выделенная картинка — тоже
        // не пустое выделение, но начертания к ней неприменимы: у неё своя панель.
        from !== to && !current.isActive('codeBlock') && !current.isActive('image')
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
