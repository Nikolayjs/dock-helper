import { Node } from '@tiptap/core';
import { CharacterCount } from '@tiptap/extensions';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';

import { ResizableImage } from './resizableImage';

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Разрыв страницы — то, чего нет в HTML, но без чего документ Word неполон.
 *
 * Направление на двух листах или приложение к справке должны начинаться с новой страницы, и решать
 * это должен врач, а не то, куда случайно легли строки при печати. В `.docx` уходит настоящий
 * `<w:br w:type="page"/>`; на экране — пунктирная полоса с подписью.
 *
 * Обратно из Word не читается: `mammoth` разрывы страниц не отдаёт. Текст при этом не теряется —
 * теряется только место разрыва, и это единственное, что импорт про него забывает.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': 'true' }],
});

/** Начертания, которые есть на любой машине с Word: список из тех, что не подменятся при открытии. */
export const FONT_FAMILIES = ['Times New Roman', 'Arial', 'Calibri', 'Georgia', 'Courier New'];

/** Кегли в пунктах — той же единице, в которой размер хранит Word. */
export const FONT_SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '24pt'];

/**
 * Схема, под которую написан `writeDocx`. Одна на всех, кто отдаёт документ в Word.
 *
 * Расширять её можно только вместе с писателем: редактор, умеющий что-то сверх, отдал бы в .docx
 * документ с дырой на месте лишнего. Всё, что здесь перечислено, `writeDocx` умеет выгружать.
 */
export function useRichTextEditor(initialContent: string) {
  return useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Subscript,
      Superscript,
      // Маркер многоцветный: у Word свои именованные цвета выделения, и писатель переводит наши
      // в них — см. HIGHLIGHT_TO_WORD.
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      PageBreak,
      // Картинке можно задать ширину и выравнивание — оба свойства уходят в .docx.
      ResizableImage.configure({ allowBase64: true }),
      // Таблицы здесь ради Word: протокол или схема дозирования приходят таблицей, и схема без
      // таблиц роняла бы её на импорте молча.
      TableKit.configure({ table: { resizable: true } }),
      CharacterCount,
    ],
    content: initialContent,
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
}
