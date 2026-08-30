/**
 * Ширина столбца и высота строки: в чём они хранятся и почему не в пикселях.
 *
 * Обе величины хранятся **в единицах Excel** — ширина в знаках, высота в пунктах, — потому что
 * оттуда они и уходят в файл: `<col width>` принимает знаки, `<row ht>` — пункты. Храни мы пиксели,
 * пересчёт пришлось бы делать в писателе `.xlsx`, то есть в том месте, где ошибку в коэффициенте
 * заметить труднее всего: на экране всё выглядело бы правильно, а в Excel — нет.
 *
 * Пересчёт поэтому живёт здесь, на границе с экраном, и в обе стороны.
 */

/** Ширина одного знака шрифта Excel по умолчанию, в пикселях экрана. Приближение, и этого хватает. */
const CHAR_PX = 8;

/** Пункт — 1/72 дюйма, экран считает 96 точек на дюйм. */
const PT_PX = 96 / 72;

/** Потолки те же, что у писателя `.xlsx`: столбец уже четырёх знаков нечитаем, шире 120 не бывает. */
export const MIN_COLUMN_CHARS = 4;
export const MAX_COLUMN_CHARS = 120;

/** Строка ниже кегля не читается, выше листа не печатается. */
export const MIN_ROW_POINTS = 10;
export const MAX_ROW_POINTS = 400;

export function columnPx(chars: number | null | undefined): number | null {
  return chars ? Math.round(chars * CHAR_PX) : null;
}

export function columnChars(px: number): number {
  return clamp(Math.round(px / CHAR_PX), MIN_COLUMN_CHARS, MAX_COLUMN_CHARS);
}

export function rowPx(points: number | null | undefined): number | null {
  return points ? Math.round(points * PT_PX) : null;
}

export function rowPoints(px: number): number {
  return clamp(Math.round(px / PT_PX), MIN_ROW_POINTS, MAX_ROW_POINTS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
