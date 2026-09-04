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
 * Сжатую картинку стоит развести по контрасту, резкую — не стоит, и это тоже замер.
 *
 * | что подали | без обработки | с контрастом |
 * |---|---|---|
 * | 800 px, снимок экрана (PNG, резкий) | 11 из 13 | **9** |
 * | 1100 px JPEG (как отдаёт просмотрщик) | 8 | **10** |
 * | 1400 px JPEG | 13 | 13 |
 * | 1700 px, нарисовано нами (PNG) | 13 | 13 |
 *
 * Признак — потери при сжатии: JPEG и WebP размывают штрихи и добавляют кайму вокруг букв, и
 * растягивание тонов возвращает границу между буквой и бумагой. Резкому PNG растягивать нечего:
 * контраст там и так предельный, а обработка съедает тонкие штрихи — отсюда 11 → 9.
 */
const SOFTENED_BY_COMPRESSION = ['image/jpeg', 'image/webp'];

/** Насколько разводить тона. Полтора — заметно, но ещё не выжигает тонкие штрихи. */
const CONTRAST = 1.6;

/**
 * Привести снимок к рабочей ширине. Только вниз и только если есть что уменьшать.
 *
 * Неудача здесь ничего не стоит: отдаём как было — распознавание всё равно попробует, а отказ из-за
 * подготовки картинки был бы отказом на ровном месте.
 */
export async function fitForOcr(image: Blob): Promise<Blob> {
  try {
    const boost = SOFTENED_BY_COMPRESSION.includes(image.type);
    const bitmap = await createImageBitmap(image);
    const scale = bitmap.width > OCR_RESIZE_ABOVE ? OCR_TARGET_WIDTH / bitmap.width : 1;
    if (scale === 1 && !boost) {
      bitmap.close();
      return image;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return image;
    }
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    if (boost) {
      // Серый и растяжение тонов: буквы к чёрному, бумага к белому. Ничего не выдумывается — только
      // разводится то, что сжатие свело вместе.
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const grey = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
        const stretched = Math.max(0, Math.min(255, (grey - 128) * CONTRAST + 128));
        data[index] = stretched;
        data[index + 1] = stretched;
        data[index + 2] = stretched;
      }
      context.putImageData(pixels, 0, 0);
    }

    // Всегда PNG: второй проход через JPEG добавил бы к потерям исходника свои.
    const prepared = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return prepared ?? image;
  } catch {
    return image;
  }
}
