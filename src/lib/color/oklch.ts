/**
 * Цвет в OKLCh и обратно — ровно столько, сколько нужно, чтобы построить палитру по обоям.
 *
 * Своя математика, а не библиотека, по той же причине, что `writeXlsx` и `writeDocx`: нужен один
 * переход sRGB ↔ OKLCh, проверка контраста по WCAG и посадка цвета обратно в охват экрана. Любой
 * пакет цветоведения весит десятки килобайт ради пространств, которых мы не используем.
 *
 * Почему OKLCh, а не HSL: в HSL «одинаковая светлота» для жёлтого и синего означает совсем разную
 * яркость на экране, и палитра, собранная перекраской тона в HSL, теряет контраст на одних тонах и
 * набирает на других. В OKLCh светлота перцептивная — можно взять готовый профиль фирменной палитры
 * и заменить в нём только тон.
 */

export interface Oklch {
  /** Перцептивная светлота, 0…1. */
  l: number;
  /** Насыщенность (хрома), 0…~0.4. */
  c: number;
  /** Тон в градусах, 0…360. */
  h: number;
}

export type Rgb = [number, number, number];

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** `#rrggbb` → каналы 0…1. Короткая запись `#rgb` тоже принимается. */
export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const value = Number.parseInt(full, 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToOklch([r, g, b]: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: lightness, c: Math.hypot(a, bb), h: hue < 0 ? hue + 360 : hue };
}

/** Может выйти за пределы 0…1 — то есть за охват экрана; сажает обратно `clampToGamut`. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    linearToSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    linearToSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    linearToSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function inGamut([r, g, b]: Rgb): boolean {
  const ok = (v: number) => v >= -0.0001 && v <= 1.0001;
  return ok(r) && ok(g) && ok(b);
}

/**
 * Убавляет насыщенность, пока цвет не поместится в sRGB, — светлота и тон остаются.
 *
 * Резать по каналам нельзя: обрезка сдвигает и тон, и светлоту, и `#ff0000` из недостижимого
 * ярко-красного превращается в другой цвет, а не в ближайший достижимый.
 */
export function clampToGamut(color: Oklch): Oklch {
  if (inGamut(oklchToRgb(color))) return color;
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToRgb({ ...color, c: mid }))) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
}

export function oklchToHex(color: Oklch): string {
  return rgbToHex(oklchToRgb(clampToGamut(color)));
}

/** Относительная яркость по WCAG 2.1 — не то же, что светлота OKLCh, и именно она в формуле контраста. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Отношение контраста двух цветов по WCAG: от 1 (неразличимы) до 21 (чёрное на белом). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
