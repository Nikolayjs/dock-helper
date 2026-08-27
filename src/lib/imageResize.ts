/**
 * Downscales an uploaded image client-side (canvas) and returns it as a data URL, so avatars/
 * signatures never store a multi-megabyte photo as text in the database — same idea as the
 * cover-thumbnail extraction already done for library books (see features/library/pdfMeta.ts).
 */
export function resizeImageToDataUrl(
  file: File,
  maxDimension: number,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
  /** Учитывается только для JPEG. Обоям хватает и меньшего: их видно приглушёнными и под карточками. */
  quality = 0.9,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
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
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mimeType, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
