import type { InterpretationRange } from './types';

/**
 * Округление результата — **до** выбора полосы толкования, а не при показе.
 *
 * Врач видит округлённое число, и полоса обязана относиться именно к нему. Клиренс креатинина с
 * `decimals: 0` и полосами «до 30» / «30–60»: результат 29,6 печатается как «30», а полоса по
 * сырому числу выходила «Тяжёлое снижение» — то есть плашка противоречила числу над ней. Эта же
 * строка уходит кнопкой «Записать в визит» в карту пациента, где противоречие остаётся навсегда.
 */
export function roundResult(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/**
 * Полоса толкования для результата.
 *
 * Границы полуоткрыты: нижняя включительно, верхняя — нет. Иначе соседние полосы, написанные
 * стык-в-стык (`0–30`, `30–60`), обе принимали бы ровно 30, и какая выиграет — решал бы порядок в
 * массиве.
 */
export function matchInterpretation(
  result: number,
  ranges: InterpretationRange[] | undefined,
): InterpretationRange | undefined {
  if (!ranges) return undefined;
  return ranges.find(
    (range) =>
      (range.min === undefined || result >= range.min) && (range.max === undefined || result < range.max),
  );
}
