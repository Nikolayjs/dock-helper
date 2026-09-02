import { describe, expect, it } from 'vitest';

import { interpretationWarnings, matchInterpretation, roundResult } from './interpretation';
import type { InterpretationRange } from './types';

/** Полосы клиренса креатинина: ровно те, на которых ловушка и нашлась. */
const CLEARANCE: InterpretationRange[] = [
  { id: 'r1', max: 30, label: 'Тяжёлое снижение', color: 'red' },
  { id: 'r2', min: 30, max: 60, label: 'Умеренное снижение', color: 'orange' },
  { id: 'r3', min: 60, label: 'Норма', color: 'teal' },
];

describe('полоса толкования выбирается по показанному числу', () => {
  it('29,6 при decimals: 0 — это «30», и полоса берётся тридцати, а не двадцати девяти', () => {
    const shown = roundResult(29.6, 0);
    expect(shown).toBe(30);
    expect(matchInterpretation(shown, CLEARANCE)?.label).toBe('Умеренное снижение');
    // До правки полоса искалась по сырому 29,6 — плашка говорила «Тяжёлое снижение» под числом 30.
    expect(matchInterpretation(29.6, CLEARANCE)?.label).toBe('Тяжёлое снижение');
  });

  it('нижняя граница включительно, верхняя — нет', () => {
    expect(matchInterpretation(30, CLEARANCE)?.label).toBe('Умеренное снижение');
    expect(matchInterpretation(59.9, CLEARANCE)?.label).toBe('Умеренное снижение');
    expect(matchInterpretation(60, CLEARANCE)?.label).toBe('Норма');
  });

  it('без полос толкования нет', () => {
    expect(matchInterpretation(12, undefined)).toBeUndefined();
  });

  it('число с дробью округляется до заданного знака, а не обрезается', () => {
    expect(roundResult(24.749, 1)).toBe(24.7);
    expect(roundResult(24.75, 1)).toBe(24.8);
  });
});

describe('конструктор предупреждает о дырявых полосах', () => {
  const range = (id: string, label: string, min?: number, max?: number): InterpretationRange => ({ id, label, color: 'brand', min, max });

  it('ловит учебниковые полосы ИМТ, между которыми проваливается значение', () => {
    const [first] = interpretationWarnings([
      range('a', 'Норма', 18.5, 24.9),
      range('b', 'Избыточная масса', 25, 29.9),
    ]);
    expect(first).toContain('разрыв');
    expect(first).toContain('24,9');
    expect(first).toContain('до 25');
    // И это не выдумка: значение между полосами действительно не толкуется ничем.
    expect(matchInterpretation(24.95, [range('a', 'Норма', 18.5, 24.9), range('b', 'Избыток', 25, 29.9)])).toBeUndefined();
  });

  it('молчит на полосах, написанных стык-в-стык', () => {
    expect(interpretationWarnings([range('a', 'Норма', undefined, 25), range('b', 'Избыток', 25, 30), range('c', 'Ожирение', 30)])).toEqual([]);
  });

  it('называет пересечение и перевёрнутую полосу', () => {
    expect(interpretationWarnings([range('a', 'Первая', 0, 30), range('b', 'Вторая', 25, 60)])[0]).toContain('пересекаются');
    expect(interpretationWarnings([range('a', 'Перевёрнутая', 18, 5)])[0]).toContain('не попадёт ни одно значение');
  });

  it('одна полоса без границ — не ошибка', () => {
    expect(interpretationWarnings([range('a', 'Любое значение')])).toEqual([]);
  });
});
