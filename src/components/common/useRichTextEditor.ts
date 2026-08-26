import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { TableKit } from '@tiptap/extension-table';
import { Underline } from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Схема, под которую написан `writeDocx`. Одна на всех, кто отдаёт документ в Word. */
export function useRichTextEditor(initialContent: string) {
  return useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Image.configure({ allowBase64: true }),
      // Таблицы здесь ради Word: протокол или схема дозирования приходят таблицей, и схема без
      // таблиц роняла бы её на импорте молча.
      TableKit.configure({ table: { resizable: true } }),
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

