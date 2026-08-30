import { resizeImageSrcToDataUrl } from '../../lib/imageResize';

/**
 * Обложка статьи: как она выбирается и почему это делает браузер, а не сервер.
 *
 * Обложек две дороги — врач выбирает файл сам либо ею становится первая картинка текста, — и обе
 * сходятся здесь: что бы ни было выбрано, в базу уходит **эскиз**, а не сама картинка.
 *
 * Считать обложку из текста на сервере или на странице списка нельзя: список намеренно приходит
 * **без** `content` — именно тексты весили 412 КБ из 517, и их оттуда убрали. Значит, первую
 * картинку видит только тот, у кого текст перед глазами: редактор. Он и записывает обложку —
 * один раз, при сохранении.
 *
 * Размер выбран по карточке, а не «на глаз»: в сетке три карточки в ряд, на широком экране это
 * ~350 px, и 640 px покрывают её с запасом на плотный экран. Полноразмерная картинка вернула бы в
 * ответ списка те самые сотни килобайт, ради которых из него убрали тексты.
 */
export const COVER_MAX_DIMENSION = 640;

/**
 * Обложку видно на карточке размером с ладонь; разница с 0,9 на глаз неразличима, вес — вдвое.
 *
 * Замеры на снимке 1600×900: обычная фотография ужимается до 9 КБ, зашумлённая до предела — до 33.
 * Второй случай и есть причина потолка ниже: в ответе списка 33 КБ превращаются в 45 КБ разметки,
 * а список едет с каждой страницы базы знаний.
 */
export const COVER_QUALITY = 0.72;

/**
 * Выше этого обложка пережимается ещё раз, помельче.
 *
 * Это не про красоту, а про ответ списка: сотня статей с тяжёлыми обложками вернула бы туда те
 * самые сотни килобайт, ради которых из него убрали тексты. Замер на худшем случае: 33 КБ → 18.
 */
const COVER_MAX_BYTES = 40 * 1024;
const COVER_FALLBACK_DIMENSION = 480;
const COVER_FALLBACK_QUALITY = 0.62;

/**
 * Прозрачность JPEG не хранит, и без заливки прозрачные места становятся **чёрными**.
 *
 * Белый выбран потому, что таким этот же логотип напечатается на бумаге; тянуть сюда цвет темы
 * нельзя — обложка одна на светлую и тёмную.
 */
const FLATTEN_ONTO = '#ffffff';

const RASTER_DATA_URL = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

/**
 * Годится ли адрес в обложку.
 *
 * Обложка рисуется обычным `<img src>` — **мимо `SafeHtml`**, через который проходит текст
 * документа, — и адрес вида `javascript:` оказался бы там без всякой проверки. Поэтому список
 * закрытый: растровые `data:` и обычные ссылки.
 *
 * SVG в нём нет намеренно, по той же причине, по которой его нет у обложек FB2: это документ со
 * скриптами, а не картинка.
 */
export function isSafeImageSrc(src: string | null | undefined): boolean {
  const value = (src ?? '').trim();
  return RASTER_DATA_URL.test(value) || /^https?:\/\//i.test(value);
}

/**
 * Первая картинка текста — та, которая станет обложкой, если врач не выбрал свою.
 *
 * Разбирается `DOMParser`, а не присвоением `innerHTML`: присвоение выполняет чужую разметку —
 * запускает загрузку картинок и их `onerror`, — а здесь нужно только посмотреть.
 */
export function firstImageSrc(html: string): string | null {
  if (!html.includes('<img')) return null;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const img of Array.from(parsed.querySelectorAll('img'))) {
    const src = img.getAttribute('src')?.trim() ?? '';
    if (isSafeImageSrc(src)) return src;
  }
  return null;
}

/** Вес самой картинки, а не строки: base64 занимает на треть больше. */
function byteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  return comma < 0 ? dataUrl.length : Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}

/**
 * Эскиз обложки из адреса картинки.
 *
 * Чужая ссылка возвращается как есть: перекодировать её нечем — холст с картинкой с другого сайта
 * «испорчен», и `toDataURL` на нём бросает, — да и незачем: в ответе списка она весит свою сотню
 * байт, а не сотню килобайт.
 *
 * `null` означает «обложки не будет»: непригодный адрес, битая картинка, недоступный холст. Терять
 * здесь нечего — сама картинка остаётся в тексте, теряется только её уменьшенная копия.
 */
export async function makeCover(src: string): Promise<string | null> {
  if (!isSafeImageSrc(src)) return null;
  if (!src.startsWith('data:')) return src;
  try {
    const cover = await resizeImageSrcToDataUrl(src, COVER_MAX_DIMENSION, 'image/jpeg', COVER_QUALITY, FLATTEN_ONTO);
    if (byteLength(cover) <= COVER_MAX_BYTES) return cover;
    return await resizeImageSrcToDataUrl(
      src,
      COVER_FALLBACK_DIMENSION,
      'image/jpeg',
      COVER_FALLBACK_QUALITY,
      FLATTEN_ONTO,
    );
  } catch {
    return null;
  }
}

/**
 * Обложка из выбранного файла — тем же путём, что и из текста.
 *
 * Отказ приходит словами, а не пустотой: HEIC iPhone сохраняет по умолчанию, и «ничего не
 * произошло» врач прочитал бы как поломку — та же причина, по которой о нём говорит сканер бланков.
 */
export async function coverFromFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

  if (!isSafeImageSrc(dataUrl)) {
    const heic = /^data:image\/hei[cf]/i.test(dataUrl);
    throw new Error(
      heic
        ? 'iPhone сохраняет снимки в HEIC — такую картинку браузер не читает. Пересохраните её в JPEG или PNG.'
        : 'Обложкой может стать только картинка: JPEG, PNG, WebP или GIF.',
    );
  }

  const cover = await makeCover(dataUrl);
  if (!cover) throw new Error('Картинку не удалось перекодировать — попробуйте другой файл');
  return cover;
}
