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

/**
 * Что не так с набором полос — предупреждением, а не запретом.
 *
 * Границы полуоткрыты (`от` включается, `до` — нет), а подписаны они по-русски включающе. Врач
 * заводит полосы ИМТ как в учебнике — `18,5–24,9`, `25–29,9`, — и значение 24,95 не попадает
 * **никуда**: плашка толкования пропадает совсем, без объяснения. Заводские полосы написаны
 * стык-в-стык и потому работают, так что ловушка ждёт первого же своего калькулятора.
 *
 * Это именно предупреждение: разрыв бывает и намеренным — шкала, у которой промежуточные значения
 * не толкуются, — а запрет заставил бы дописывать полосы, которых у врача нет.
 */
export function interpretationWarnings(ranges: InterpretationRange[]): string[] {
  const named = (range: InterpretationRange) => (range.label.trim() ? `«${range.label.trim()}»` : 'полоса без названия');
  const ru = (value: number) => String(value).replace('.', ',');
  const warnings: string[] = [];

  for (const range of ranges) {
    if (range.min !== undefined && range.max !== undefined && range.min >= range.max) {
      warnings.push(`У полосы ${named(range)} «от» не меньше, чем «до»: в неё не попадёт ни одно значение.`);
    }
  }

  const sorted = [...ranges]
    .filter((range) => !(range.min !== undefined && range.max !== undefined && range.min >= range.max))
    .sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (previous.max === undefined || current.min === undefined) continue;
    if (previous.max > current.min) {
      warnings.push(
        `Полосы ${named(previous)} и ${named(current)} пересекаются на ${ru(current.min)}–${ru(previous.max)}: ` +
          'значение попадёт в ту, что стоит выше в списке.',
      );
    } else if (previous.max < current.min) {
      warnings.push(
        `Между ${named(previous)} (до ${ru(previous.max)}) и ${named(current)} (от ${ru(current.min)}) разрыв: ` +
          `${ru(previous.max)} не попадёт ни в одну полосу. Верхняя граница не включается — напишите «до ${ru(current.min)}».`,
      );
    }
  }

  return warnings;
}
