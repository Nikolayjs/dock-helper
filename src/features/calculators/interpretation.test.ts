import { describe, expect, it } from 'vitest';

import { matchInterpretation, roundResult } from './interpretation';
import type { InterpretationRange } from './types';

/** Полосы клиренса креатинина: ровно те, на которых ловушка и нашлась. */
const CLEARANCE: InterpretationRange[] = [
  { max: 30, label: 'Тяжёлое снижение', color: 'red' },
  { min: 30, max: 60, label: 'Умеренное снижение', color: 'orange' },
  { min: 60, label: 'Норма', color: 'teal' },
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
