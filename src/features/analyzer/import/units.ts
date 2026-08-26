/**
 * Whether two units measure the same thing, and by what factor they differ.
 *
 * Russian laboratories print the same analyte in two conventions. The SI one — `×10⁹/л`, `г/л` —
 * is what the built-in analyzers use, and what a doctor here reads without arithmetic. The
 * American one — `тыс/мкл`, `млн/мкл`, `г/дл` — is what Инвитро and most private laboratories
 * print. They are not variant spellings: `тыс/мкл` and `×10⁹/л` happen to carry the same number,
 * while `г/дл` and `г/л` differ by a factor of ten.
 *
 * Without this the unit guard in `matchAnalytes` vetoes the correct parameter — it sees two stated
 * units that are not equal and concludes they disagree — and a whole ОАК imports as five fields out
 * of nineteen. With it the guard keeps doing the job it was written for, because `×10¹²/л` and
 * `в п/зр` still have no common canonical form and still block the pairing.
 *
 * **Molar conversions are deliberately absent.** `мг/дл` → `ммоль/л` needs the analyte's molar
 * mass, which a unit table does not know: glucose and creatinine printed in `мг/дл` divide by 18
 * and by 0.0113 respectively. Guessing one factor for both would put a plausible wrong number in
 * front of a doctor, which is worse than the empty field it replaces. Those stay unmatched.
 */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/** `×10¹²/л`, `10^12/л` and `10*12/л` are the same unit written three ways; all reduce to `1012/л`. */
export function normalizeUnit(unit: string): string {
  return [...unit.toLowerCase().replace(/ё/g, 'е')]
    .map((char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .join('')
    .replace(/[\s×*^]/g, '');
}

interface Convertible {
  /** An arbitrary label shared by every unit measuring this quantity at this scale. */
  quantity: string;
  /** Multiply a value in this unit by this to reach the quantity's base. */
  toBase: number;
}

/**
 * Keys are already `normalizeUnit`-ed. Only units that actually appear on Russian laboratory forms
 * are listed: a table that tries to be complete is a table nobody can check.
 */
const CONVERTIBLE: Record<string, Convertible> = {
  // Cell counts. 1 тыс/мкл = 10³/мкл = 10⁹/л, so the two conventions coincide numerically —
  // which is exactly why the mismatch is easy to miss: the numbers on screen were never wrong,
  // they simply never arrived.
  '109/л': { quantity: 'count9', toBase: 1 },
  'тыс/мкл': { quantity: 'count9', toBase: 1 },
  '103/мкл': { quantity: 'count9', toBase: 1 },
  'к/мкл': { quantity: 'count9', toBase: 1 },
  'кл/мкл': { quantity: 'count9', toBase: 1 },

  '1012/л': { quantity: 'count12', toBase: 1 },
  'млн/мкл': { quantity: 'count12', toBase: 1 },
  '106/мкл': { quantity: 'count12', toBase: 1 },

  // Mass concentration. Here the conventions genuinely differ: haemoglobin 16.6 г/дл is 166 г/л.
  'г/л': { quantity: 'massConc', toBase: 1 },
  'г/дл': { quantity: 'massConc', toBase: 10 },
  'мг/мл': { quantity: 'massConc', toBase: 1 },
  'г/100мл': { quantity: 'massConc', toBase: 10 },

  // Volume. MCV is printed both ways and the two are identical.
  фл: { quantity: 'volume', toBase: 1 },
  'мкм3': { quantity: 'volume', toBase: 1 },
};

/**
 * What to multiply a value in `from` by so it reads correctly in `to`, or `null` when the two
 * units are not comparable at all.
 *
 * A unit the table does not know is comparable only to itself — silence about a unit is not a
 * claim that it converts to anything.
 */
export function conversionFactor(from: string, to: string): number | null {
  const a = normalizeUnit(from);
  const b = normalizeUnit(to);
  if (a === b) return 1;

  const left = CONVERTIBLE[a];
  const right = CONVERTIBLE[b];
  if (!left || !right || left.quantity !== right.quantity) return null;

  return left.toBase / right.toBase;
}

/**
 * Applies the factor and rounds off the noise it introduces.
 *
 * 16.6 × 10 lands on 166.00000000000003 in binary floating point, and a value shown to the doctor
 * like that reads as a bug in the import rather than a haemoglobin.
 */
export function convertValue(value: number, factor: number): number {
  if (factor === 1) return value;
  return Number((value * factor).toPrecision(12));
}
