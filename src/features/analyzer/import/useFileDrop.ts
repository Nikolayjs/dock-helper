import { useEffect, useState } from 'react';

/**
 * Перетаскивание файла на страницу.
 *
 * Бланк почти всегда уже лежит в загрузках: врач посмотрел его в почте и скачал. Дорога «нажать
 * „Загрузить файл“ → найти в диалоге → открыть» — три движения после того, как файл уже виден на
 * экране; перетаскивание оставляет одно.
 *
 * **Слушается окно, а не рамка страницы.** Бросают куда попало — в середину списка показателей, в
 * пустое место справа, — и рамка, ловящая только свою площадь, отвечала бы через раз. Ошибиться при
 * этом нечем: файл, брошенный мимо, браузер открыл бы вместо страницы, и это заметно хуже.
 *
 * `dragover` обязателен вместе с `preventDefault`: без него браузер считает, что бросать сюда
 * нельзя, и открывает файл в этой же вкладке — то есть уводит врача со страницы вместе с
 * несохранённой работой.
 */
export function useFileDrop(onFile: (file: File) => void, accept: readonly string[]): boolean {
  const [over, setOver] = useState(false);

  useEffect(() => {
    /*
     * Счётчик, а не флаг: `dragenter`/`dragleave` приходят и от вложенных элементов, и по одному
     * флагу подсветка мигала бы на каждой границе внутри страницы.
     */
    let depth = 0;

    const isFile = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes('Files');

    const onDragEnter = (event: DragEvent) => {
      if (!isFile(event)) return;
      depth += 1;
      setOver(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (!isFile(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const onDragOver = (event: DragEvent) => {
      if (!isFile(event)) return;
      event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!isFile(event)) return;
      event.preventDefault();
      depth = 0;
      setOver(false);
      // Первый файл: разбор всё равно работает с одним бланком за раз, и брать «какой-нибудь из
      // пяти» значило бы решать за врача, какой именно.
      const file = event.dataTransfer?.files?.[0];
      if (file && (accept.length === 0 || accept.includes(file.type))) onFile(file);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [onFile, accept]);

  return over;
}

/** То же, что принимает `labFileText`: PDF из лаборатории и снимок бланка. */
export const LAB_FILE_ACCEPT = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/bmp',
] as const;
