/**
 * Pulls `name → value` pairs out of the lines of a lab report.
 *
 * A result row reads `Гемоглобин 145 г/л 130 - 160`: name, result, unit, then the lab's own
 * reference interval. The result is taken as the FIRST standalone number on the row, which is what
 * separates it from the interval that follows — and why the scan is token-based rather than a
 * regex over the raw string. `Витамин B12 350 пг/мл` is the case that settles it: as a token `B12`
 * is not a number, so the name survives intact, where a digit-hunting regex would cut it in half.
 *
 * Everything here is a heuristic over layouts no two laboratories agree on. It is built to be
 * over-inclusive and let the review screen throw away the junk, because a missed analyte is
 * invisible to the doctor while a spurious one is obvious on sight.
 */

export interface ParsedAnalyte {
  name: string;
  value: number;
  unit?: string;
  /** The row it came from, shown in the review screen so a wrong pairing can be spotted. */
  line: string;
}

/**
 * A result on its own: optionally bounded (`<0,5`), optionally signed, decimal comma or point, and
 * optionally carrying the mark a laboratory prints beside a result outside its reference interval.
 * Инвитро writes `51*`; without the trailing mark here that token stops being a number, the scan
 * walks on past the previous-result column and settles on the reference bound — filing `< 41` as
 * though the patient's ALT were 41.
 */
const STANDALONE_NUMBER = /^[<>≤≥]?-?\d+(?:[.,]\d+)?[*↑↓]*$/;

/** `21.09.24` in the previous-result column is not a measurement. */
const DATE_LIKE = /^\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}$/;

/**
 * How far past the result to look for its unit. Инвитро puts the previous result and its date in
 * between, so the unit is not always the next token — but wandering the whole row would eventually
 * mistake a comment for a unit.
 */
const UNIT_SCAN_WINDOW = 3;

const HAS_LETTERS = /[а-яёa-z]/i;

/**
 * A negative result written as a word. Most of a normal urinalysis reads this way, and without
 * recognising it the scan runs past the result column entirely and takes the first number it
 * finds — which is the lower reference bound, in a row whose name has by then swallowed the units
 * and the word `Здоровые`. It lands on 0 and looks right, for entirely the wrong reason.
 */
const NEGATIVE_RESULT = /^(отриц|отрицательн|не\s*обнаруж|нет|neg|negative|abs)/i;

/**
 * A graded positive — `+`, `++`, `+/-`. The row ends here as far as reading a number goes: the
 * scale behind the plus signs belongs to the parameter, not the file, so guessing 1 for a
 * three-plus result would be worse than leaving it for the doctor.
 */
const GRADED_RESULT = /^[+]+$|^\+\/-$|^-\/\+$/;

/**
 * Rows that are page furniture rather than results. Matched against the *name* only, so an analyte
 * whose name merely contains one of these words is unaffected.
 *
 * The trailing guard is a lookahead, not `\b`: JavaScript defines word boundaries over ASCII `\w`
 * only, so `/^пациент\b/` never matches "Пациент:" — the header row it exists to reject sailed
 * straight through until a test caught it.
 */
const NOT_AN_ANALYTE =
  /^(результат|референс|референсные|норма|нормы|единиц|показател|пациент|дата|врач|лаборатор|заключени|комментари|исследовани|материал|метод|подпись|страниц|телефон|адрес|заказ|номер|возраст|пол)(?![а-яёa-z])/i;

/** Above this nothing is a laboratory measurement — it is an order number or a phone that slipped through. */
const IMPLAUSIBLE_VALUE = 1_000_000;

function looksLikeUnit(token: string): boolean {
  if (STANDALONE_NUMBER.test(token)) return false;
  // Ranges (`130-160`, `4,0–9,0`) trail the result and must not be mistaken for its unit.
  if (/^\d+(?:[.,]\d+)?\s*[-–—]\s*\d/.test(token)) return false;
  return /[а-яёa-z%^*/]/i.test(token);
}

/**
 * A unit cut in half by a column too narrow for it — `мкмоль/` where the `л` wrapped to the next
 * line. Reporting it as the unit is worse than reporting none: the fragment matches no parameter's
 * unit, so the guard that exists to stop a value reaching the wrong analyte would instead push it
 * there, by vetoing the right parameter and leaving only a unit-less lookalike.
 */
function looksTruncated(token: string): boolean {
  return /[/(\-–—]$/.test(token);
}

/**
 * Tokens that never stand alone as a unit and always open a longer one — `в п/зр`, `в поле зрения`.
 * Taking the preposition by itself is worse than reporting no unit at all: `в` matches no
 * parameter's unit, so the guard that exists to keep a value out of the wrong field instead vetoes
 * the right one. Only the word is joined, never a general run of tokens: the column after the unit
 * is sometimes prose (`ммоль/л см.комм Рекомендации по интерпретации`), and swallowing it would
 * break rows that read correctly today.
 */
const UNIT_PREFIXES = new Set(['в', 'кл', 'ед']);

/** Skips the previous-result column to reach the unit, but stops at the first token that is neither. */
function findUnit(tokens: string[], from: number): string | undefined {
  for (let i = from; i < Math.min(tokens.length, from + UNIT_SCAN_WINDOW); i++) {
    const token = tokens[i];
    if (token === undefined) return undefined;
    if (STANDALONE_NUMBER.test(token) || DATE_LIKE.test(token)) continue;
    if (!looksLikeUnit(token) || looksTruncated(token)) return undefined;

    if (UNIT_PREFIXES.has(token.toLowerCase())) {
      const next = tokens[i + 1];
      if (!next || !looksLikeUnit(next) || looksTruncated(next)) return undefined;
      return `${token} ${next}`;
    }
    return tokens[i];
  }
  return undefined;
}

export function parseLabValues(lines: string[]): ParsedAnalyte[] {
  const analytes: ParsedAnalyte[] = [];

  for (const line of lines) {
    const tokens = line.split(/\s+/).filter(Boolean);
    // Whichever comes first ends the name: a number, a spelled-out negative, or a graded positive.
    const valueIndex = tokens.findIndex(
      (token) =>
        (STANDALONE_NUMBER.test(token) && !DATE_LIKE.test(token)) ||
        NEGATIVE_RESULT.test(token) ||
        GRADED_RESULT.test(token),
    );
    if (valueIndex <= 0) continue;
    const valueToken = tokens[valueIndex] ?? '';
    // A graded positive names no number the file can be trusted to scale; the row stops here.
    if (GRADED_RESULT.test(valueToken)) continue;

    const name = tokens
      .slice(0, valueIndex)
      .join(' ')
      .replace(/[:：]\s*$/, '')
      .replace(/[.,]\s*$/, '')
      .trim();

    if (name.length < 2 || !HAS_LETTERS.test(name) || NOT_AN_ANALYTE.test(name)) continue;
    // A Russian analyte is capitalised on every laboratory form, so a lowercase Cyrillic opening
    // means this is the tail of a wrapped sentence — `желательный уровень <5.0 ммоль/л` out of an
    // interpretation note. Latin is left alone: `pH` and `hs-CRP` are real names.
    if (/^[а-яё]/.test(name)) continue;

    const isNegative = NEGATIVE_RESULT.test(valueToken);
    const value = isNegative
      ? 0
      : Number(valueToken.replace(/^[<>≤≥]/, '').replace(/[*↑↓]+$/, '').replace(',', '.'));
    if (!Number.isFinite(value) || Math.abs(value) > IMPLAUSIBLE_VALUE) continue;

    analytes.push({ name, value, unit: findUnit(tokens, valueIndex + 1), line });
  }

  return analytes;
}
