import { BRAND_STEPS } from '../../theme';
import { contrastRatio, hexToRgb, oklchToHex, rgbToOklch, type Oklch } from '../../lib/color/oklch';

/**
 * Палитра приложения, собранная по цвету обоев.
 *
 * Берётся **только тон**. Светлота и насыщенность каждой ступени остаются от фирменной палитры,
 * потому что именно они отвечают за то, читается ли белая надпись на кнопке и видно ли активный
 * пункт меню. Палитра, собранная «как на картинке», рано или поздно выдаёт кнопку, надпись на
 * которой не прочитать, — а это приложение с записями пациентов, и кнопка «Сохранить» обязана быть
 * кнопкой при любых обоях.
 *
 * Сверх этого каждая ступень, которую видно как заливку под белым текстом, дотемняется до контраста
 * 4,5:1 — потому что одна и та же светлота OKLCh на жёлтом и на синем даёт разную яркость на экране,
 * и профиль сам по себе контраста не гарантирует. Проверяется `accent.test.ts` по всем тонам.
 */

/** Порог WCAG AA для обычного текста. */
const MIN_CONTRAST = 4.5;

/** Фон приложения в тёмной теме (`--mantine-color-dark-7`) — на нём живёт светлая ступень акцента. */
const DARK_SURFACE = '#1a1b1e';

/** Ступени-заливки: под белым текстом (кнопка, активный пункт, бейдж). */
const FILLED_STEPS = [6, 7, 8, 9];

/** Ступень, которой в тёмной теме набран акцентный текст. */
const DARK_TEXT_STEP = 4;

/** Насколько бледной может выйти палитра: серые обои не должны обесцветить приложение целиком. */
const MIN_CHROMA_FACTOR = 0.4;

/** Шаг подгонки светлоты при добивании контраста. */
const STEP = 0.004;

export type PaletteSteps = [string, string, string, string, string, string, string, string, string, string];

const BRAND_PROFILE = BRAND_STEPS.map((step) => rgbToOklch(hexToRgb(step)));
const REFERENCE_CHROMA = BRAND_PROFILE[6].c;

/** Темнит, пока белый текст на заливке не станет читаемым. */
function darkenForWhiteText(color: Oklch): Oklch {
  let out = color;
  for (let i = 0; i < 200 && contrastRatio('#ffffff', oklchToHex(out)) < MIN_CONTRAST; i++) {
    out = { ...out, l: Math.max(0, out.l - STEP) };
  }
  return out;
}

/** Светлит, пока акцентный текст не станет читаемым на тёмном фоне, но не светлее соседней ступени. */
function lightenForDarkSurface(color: Oklch, ceiling: number): Oklch {
  let out = color;
  for (let i = 0; i < 200 && contrastRatio(DARK_SURFACE, oklchToHex(out)) < MIN_CONTRAST; i++) {
    const next = out.l + STEP;
    if (next >= ceiling) break;
    out = { ...out, l: next };
  }
  return out;
}

/**
 * Палитра из десяти ступеней по одному цвету.
 *
 * Насыщенность берётся у обоев, но в долях от фирменной: блёклые обои дают спокойную палитру,
 * яркие — яркую, и ни те ни другие не громче того, что было. Полностью серые обои цвет не задают
 * вовсе — см. `dominantColor`, он в этом случае молчит.
 */
export function derivePalette(sourceHex: string): PaletteSteps {
  const source = rgbToOklch(hexToRgb(sourceHex));
  const chromaFactor = Math.min(1, Math.max(MIN_CHROMA_FACTOR, source.c / REFERENCE_CHROMA));

  const steps = BRAND_PROFILE.map((base) => ({ l: base.l, c: base.c * chromaFactor, h: source.h }));

  for (const index of FILLED_STEPS) steps[index] = darkenForWhiteText(steps[index]);
  steps[DARK_TEXT_STEP] = lightenForDarkSurface(steps[DARK_TEXT_STEP], BRAND_PROFILE[DARK_TEXT_STEP - 1].l);

  return steps.map(oklchToHex) as PaletteSteps;
}

/** Размер, до которого уменьшается картинка перед подсчётом: тона это не меняет, а времени экономит всё. */
const SAMPLE_SIZE = 48;
/** Сколько корзин по тону: 15° на корзину — достаточно, чтобы не смешать оранжевое с жёлтым. */
const HUE_BUCKETS = 24;
/** Совсем светлое и совсем тёмное тона не задаёт: небо и тени есть на любом снимке. */
const MIN_LIGHTNESS = 0.2;
const MAX_LIGHTNESS = 0.9;
/** Ниже этого пиксель считается серым — у него нет тона, который стоило бы брать. */
const MIN_PIXEL_CHROMA = 0.03;
/** Доля цветных пикселей, ниже которой обои считаются бесцветными. */
const MIN_COLOURED_SHARE = 0.05;

/**
 * Господствующий цвет картинки — или `null`, если брать нечего.
 *
 * Считается не средним, а голосованием по тону: среднее у заката с синим морем даёт грязно-серый,
 * которого на картинке нет ни в одной точке. Вес голоса — насыщенность пикселя: небольшое яркое
 * пятно задаёт настроение сильнее, чем половина кадра бледной штукатурки.
 *
 * `null` — честный ответ для чёрно-белого снимка: подстраивать палитру не под что, и приложение
 * остаётся в своих цветах.
 */
export async function dominantColor(imageSrc: string): Promise<string | null> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return pickHue(data, data.length / 4);
}

/** Отделено от холста, чтобы голосование по тону можно было проверить тестом без браузера. */
export function pickHue(data: Uint8ClampedArray | number[], pixels: number): string | null {
  const sumChroma = new Array<number>(HUE_BUCKETS).fill(0);
  const sumSin = new Array<number>(HUE_BUCKETS).fill(0);
  const sumCos = new Array<number>(HUE_BUCKETS).fill(0);
  const count = new Array<number>(HUE_BUCKETS).fill(0);
  let coloured = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const { l, c, h } = rgbToOklch([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
    if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS || c < MIN_PIXEL_CHROMA) continue;
    coloured += 1;
    const bucket = Math.min(HUE_BUCKETS - 1, Math.floor((h / 360) * HUE_BUCKETS));
    const rad = (h * Math.PI) / 180;
    sumChroma[bucket] += c;
    sumSin[bucket] += Math.sin(rad) * c;
    sumCos[bucket] += Math.cos(rad) * c;
    count[bucket] += 1;
  }

  if (pixels === 0 || coloured / pixels < MIN_COLOURED_SHARE) return null;

  // Соседние корзины считаются вместе с выбранной. Без этого плавный переход — а на фотографии он
  // почти везде — дробит свои голоса между корзинами и проигрывает ровной заливке вдвое меньшей
  // площади. Проверено на закате: тёплое небо растекалось по трём корзинам, и приложение
  // окрашивалось в синеву моря.
  const at = (i: number) => (i + HUE_BUCKETS) % HUE_BUCKETS;
  const smoothed = sumChroma.map((_, i) => sumChroma[at(i - 1)] / 2 + sumChroma[i] + sumChroma[at(i + 1)] / 2);

  let best = 0;
  for (let i = 1; i < HUE_BUCKETS; i++) if (smoothed[i] > smoothed[best]) best = i;
  if (smoothed[best] === 0) return null;

  const near = [at(best - 1), best, at(best + 1)];
  const sin = near.reduce((total, i) => total + sumSin[i], 0);
  const cos = near.reduce((total, i) => total + sumCos[i], 0);
  const chromaTotal = near.reduce((total, i) => total + sumChroma[i], 0);
  const pixelTotal = near.reduce((total, i) => total + count[i], 0);

  const hue = (Math.atan2(sin, cos) * 180) / Math.PI;
  const chroma = chromaTotal / Math.max(1, pixelTotal);

  // Светлота у образца своя не нужна: её задаёт профиль палитры. Берётся середина фирменной ступени.
  return oklchToHex({
    l: BRAND_PROFILE[6].l,
    c: Math.min(REFERENCE_CHROMA, Math.max(MIN_PIXEL_CHROMA, chroma)),
    h: hue < 0 ? hue + 360 : hue,
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    image.src = src;
  });
}
