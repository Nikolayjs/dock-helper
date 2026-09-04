/**
 * Подготовка картинки к распознаванию — одна на всех, кто зовёт Tesseract.
 *
 * Мест таких два: бланк анализов из лаборатории и снимок пустого бланка в конструкторе. Правило у
 * них одно, и держать его в двух местах значило бы однажды улучшить распознавание только в одном.
 */

/**
 * Ширина, при которой распознавание работает лучше всего.
 *
 * Число не из головы, а из замера на копии настоящего бланка (таблица в рамках, 22 строки,
 * лаборатория «Прогрессивные Медицинские Технологии»). Прогонялось через тот же Tesseract, что
 * стоит на бою:
 *
 * | что подали | узнано названий показателей |
 * |---|---|
 * | 800 px (снимок экрана как есть) | 11 из 13 |
 * | 1600 px | **13 из 13** |
 * | 2400 px | **0 из 13** — таблица читается как «ООО СООО ОИ» |
 * | 2400 → 1700 px | **13 из 13** |
 * | 800 → 1700 px (растянуть) | 3 из 13 |
 * | 800 → 2600 px | 0 из 13 |
 *
 * Отсюда два правила, и второе неочевидное. **Крупное надо уменьшать**: у снимка с телефона
 * (3000–4000 px) линовка бланка выходит чётче букв, и разборщик читает рамки как текст — это и есть
 * «ужасный OCR», на который жалуются. **Мелкое растягивать нельзя**: пикселей от этого не
 * прибавляется, штрихи размываются, и выходит хуже, чем было.
 */
export const OCR_TARGET_WIDTH = 1700;

/** Ниже этого не трогаем вовсе: уменьшать нечего, а растягивать вредно. */
const OCR_RESIZE_ABOVE = 1900;

/**
 * Привести снимок к рабочей ширине. Только вниз и только если есть что уменьшать.
 *
 * Неудача здесь ничего не стоит: отдаём как было — распознавание всё равно попробует, а отказ из-за
 * подготовки картинки был бы отказом на ровном месте.
 */
export async function fitForOcr(image: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(image);
    if (bitmap.width <= OCR_RESIZE_ABOVE) {
      bitmap.close();
      return image;
    }

    const scale = OCR_TARGET_WIDTH / bitmap.width;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return image;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const shrunk = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return shrunk ?? image;
  } catch {
    return image;
  }
}
