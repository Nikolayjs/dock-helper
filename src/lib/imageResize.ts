/**
 * Форматы, в которые умеет уменьшатель.
 *
 * WebP здесь ради обложек: на них он даёт заметно меньше при том же виде. Он есть во всех живых
 * браузерах, но `canvas.toDataURL` при незнакомом типе **не отказывает, а молча возвращает PNG** —
 * поэтому результат проверяется по префиксу, а не по наличию поддержки.
 */
export type ResizeMime = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Downscales an image client-side (canvas) and returns it as a data URL, so avatars, signatures and
 * article covers never store a multi-megabyte photo as text in the database — same idea as the
 * cover-thumbnail extraction already done for library books (see features/library/pdfMeta.ts).
 */
export function resizeImageToDataUrl(
  file: File,
  maxDimension: number,
  mimeType: ResizeMime = 'image/png',
  /** Учитывается только для JPEG и WebP. Обоям хватает и меньшего: их видно приглушёнными и под карточками. */
  quality = 0.9,
  background?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      resizeImageSrcToDataUrl(reader.result as string, maxDimension, mimeType, quality, background).then(
        resolve,
        reject,
      );
    };
    reader.readAsDataURL(file);
  });
}

/**
 * То же, но из готового адреса картинки — `data:` или обычной ссылки.
 *
 * Нужно там, где картинка уже лежит в документе: обложка статьи берётся из её текста, а не из файла
 * на диске. Ссылка чужого сайта портит холст (tainted canvas), и `toDataURL` на нём бросает — это
 * ловится вызывающим, который в таком случае оставляет адрес как есть.
 *
 * `background` — для JPEG: у него нет прозрачности, и без заливки прозрачные места PNG становятся
 * **чёрными**. Заливка белым честнее: логотип с прозрачным фоном выглядит как на бумаге.
 */
export function resizeImageSrcToDataUrl(
  src: string,
  maxDimension: number,
  mimeType: ResizeMime = 'image/png',
  quality = 0.9,
  background?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Файл повреждён или не является изображением'));
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas недоступен'));
        return;
      }
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const encoded = canvas.toDataURL(mimeType, quality);
        // `toDataURL` с незнакомым типом молча отдаёт PNG — а PNG фотографии втрое тяжелее JPEG.
        // Проверяется не поддержка «вообще», а то, что вернул этот самый холст.
        if (mimeType === 'image/webp' && !encoded.startsWith('data:image/webp')) {
          resolve(canvas.toDataURL('image/jpeg', quality));
          return;
        }
        resolve(encoded);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Картинку не удалось перекодировать'));
      }
    };
    img.src = src;
  });
}
