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
 * Линовку таблицы перед распознаванием стираем, и это главная правка из всех здешних.
 *
 * Tesseract сначала **ищет строки**, и только потом читает. Рамки ячеек — длинные жирные штрихи, и
 * на них разметка ломается: строки склеиваются поперёк столбцов, а сами рамки читаются как буквы.
 * Отсюда «ООО СООО ОИ» вместо таблицы — и отсюда же то, что более крупная и чёткая картинка может
 * читаться **хуже**: чем чётче рамка, тем увереннее её принимают за текст.
 *
 * Замер на копии бланка лаборатории тем же Tesseract, что на бою (названий из 13 / строк «Отриц.»):
 *
 * | что подали | как есть | без линовки |
 * |---|---|---|
 * | 800 px, снимок экрана | 11 / **0** | 10 / **4** |
 * | 1100 px JPEG (из просмотрщика) | 8 / 10 | **12 / 13** |
 * | 1600 px | 13 / 16 | 13 / 16 |
 * | 2400 px | **0 / 0** | **12 / 16** |
 * | две страницы просмотрщика, 1600×4800 | 13 / 32 | 13 / 32 |
 *
 * На хороших входах — без изменений, на плохих — разница между «мусор» и «работает». Обратите
 * внимание на первую строку: названий стало на одно меньше, а **значений** — с нуля до четырёх;
 * считать по одним названиям было бы самообманом.
 *
 * Стирается только **длинное и тонкое**: буква не бывает длиной в сотню точек, а подчёркнутая
 * строка и плотный ряд букв не проходят проверку на толщину.
 */
const RULE_MIN_LENGTH_PART = 13;
const RULE_MIN_LENGTH = 60;
/** Насколько далеко смотреть «в стороны», чтобы отличить рамку от края буквы. */
const RULE_THICKNESS = 3;
/** Доля соседних точек, при которой штрих уже не рамка, а часть чего-то плотного. */
const RULE_NEIGHBOURS = 0.3;

/**
 * Стереть линовку: длинные тонкие штрихи по горизонтали и вертикали.
 *
 * Работает по порогу «темнее середины между самым тёмным и самым светлым» — этого хватает: бланк
 * почти всегда чёрное по белому, а полутона важны только для букв, которые мы и не трогаем.
 */
function removeRules(context: CanvasRenderingContext2D, width: number, height: number): void {
  const picture = context.getImageData(0, 0, width, height);
  const pixels = picture.data;

  /*
   * Сначала одна карта «тёмное/светлое», и только потом проходы по ней.
   *
   * Считать яркость на каждое обращение нельзя: у сшитых страниц это восемь миллионов точек, а
   * проверка толщины смотрит на соседей — вместе выходят десятки миллионов вычислений и заметная
   * пауза у врача на ровном месте.
   */
  let min = 255;
  let max = 0;
  const grey = new Uint8Array(width * height);
  for (let index = 0, at = 0; index < pixels.length; index += 4, at += 1) {
    const value = (pixels[index]! * 299 + pixels[index + 1]! * 587 + pixels[index + 2]! * 114) / 1000;
    grey[at] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const threshold = (min + max) / 2;
  const dark = new Uint8Array(width * height);
  for (let at = 0; at < dark.length; at += 1) dark[at] = grey[at]! < threshold ? 1 : 0;

  const minLength = Math.max(RULE_MIN_LENGTH, Math.round(width / RULE_MIN_LENGTH_PART));
  const erase = (at: number): void => {
    const index = at * 4;
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
  };

  // Горизонтальные штрихи: тонкие — значит и выше, и ниже по большей части светло.
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x <= width; x += 1) {
      if (x < width && dark[y * width + x] === 1) {
        if (start < 0) start = x;
        continue;
      }
      if (start >= 0 && x - start >= minLength) {
        let above = 0;
        let below = 0;
        for (let k = start; k < x; k += 1) {
          if (y >= RULE_THICKNESS && dark[(y - RULE_THICKNESS) * width + k] === 1) above += 1;
          if (y < height - RULE_THICKNESS && dark[(y + RULE_THICKNESS) * width + k] === 1) below += 1;
        }
        const length = x - start;
        if (above < length * RULE_NEIGHBOURS && below < length * RULE_NEIGHBOURS) {
          for (let k = start; k < x; k += 1) erase(y * width + k);
        }
      }
      start = -1;
    }
  }

  // Вертикальные — то же самое, только смотрим влево и вправо.
  for (let x = 0; x < width; x += 1) {
    let start = -1;
    for (let y = 0; y <= height; y += 1) {
      if (y < height && dark[y * width + x] === 1) {
        if (start < 0) start = y;
        continue;
      }
      if (start >= 0 && y - start >= minLength) {
        let left = 0;
        let right = 0;
        for (let k = start; k < y; k += 1) {
          if (x >= RULE_THICKNESS && dark[k * width + x - RULE_THICKNESS] === 1) left += 1;
          if (x < width - RULE_THICKNESS && dark[k * width + x + RULE_THICKNESS] === 1) right += 1;
        }
        const length = y - start;
        if (left < length * RULE_NEIGHBOURS && right < length * RULE_NEIGHBOURS) {
          for (let k = start; k < y; k += 1) erase(k * width + x);
        }
      }
      start = -1;
    }
  }

  context.putImageData(picture, 0, 0);
}

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

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    // `willReadFrequently`: дальше мы читаем и пишем пиксели, и без подсказки браузер держит холст
    // на видеокарте, где каждое чтение стоит перегонки кадра.
    const context = canvas.getContext('2d', { willReadFrequently: true });
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

    // Линовку — после приведения размера: на итоговой картинке рамка тоньше, и порог длины считается
    // от той ширины, которая поедет на распознавание.
    removeRules(context, canvas.width, canvas.height);

    // Всегда PNG: второй проход через JPEG добавил бы к потерям исходника свои.
    const prepared = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return prepared ?? image;
  } catch {
    return image;
  }
}
