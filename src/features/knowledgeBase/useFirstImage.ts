import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

import { isSafeImageSrc } from './cover';

/**
 * Первая картинка текста — прямо во время набора.
 *
 * Нужна, чтобы обложку, подставленную за врача, было **видно до сохранения**: подставленное молча
 * — это то же, чем был анализатор, бравший взрослые нормы ребёнку. Поэтому редактор показывает
 * ровно ту картинку, которая станет обложкой, и рядом говорит, откуда она взята.
 *
 * Читается дерево документа, а не `getHTML()`: сборка разметки статьи на **каждое нажатие** — это
 * работа, пропорциональная длине текста, а обход узлов останавливается на первой же картинке.
 * Состояние меняется, только когда адрес стал другим, — иначе набор буквы перерисовывал бы форму.
 */
export function useFirstImage(editor: Editor | null): string | null {
  const [src, setSrc] = useState<string | null>(() => (editor ? firstImageInDoc(editor) : null));

  useEffect(() => {
    if (!editor) return;
    const sync = () => setSrc((current) => {
      const next = firstImageInDoc(editor);
      return next === current ? current : next;
    });
    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);

  return src;
}

function firstImageInDoc(editor: Editor): string | null {
  let found: string | null = null;
  editor.state.doc.descendants((node) => {
    if (found) return false;
    if (node.type.name !== 'image') return true;
    const src: unknown = node.attrs.src;
    if (typeof src === 'string' && isSafeImageSrc(src)) found = src;
    return false;
  });
  return found;
}
