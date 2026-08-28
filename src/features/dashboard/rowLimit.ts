/**
 * Сколько строк карточка показывает, пока её не раскрыли.
 *
 * Хранится там же, где остальные настройки карточек, — строкой: `settings` в раскладке дашборда
 * заведомо `Record<string, string>`, и заводить рядом второе хранилище ради одного числа незачем.
 * Разбор здесь и нужен для того, чтобы испорченное или устаревшее значение не обрушило карточку:
 * прочиталось не число — берётся значение по умолчанию.
 */
export const ROW_LIMIT_OPTIONS = [3, 5, 8, 12] as const;

export const ROW_LIMIT_DEFAULT = 5;

/** Потолок на случай, если в хранилище окажется что-то своё: карточка на весь экран — не карточка. */
const ROW_LIMIT_MAX = 50;

export function readRowLimit(value: string | undefined, fallback: number = ROW_LIMIT_DEFAULT): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(ROW_LIMIT_MAX, Math.round(parsed));
}
