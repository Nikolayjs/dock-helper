import type { LabParameter, LabTestDefinition } from '../types';
import type { ParsedAnalyte } from './parseLabValues';
import { expandSynonyms } from './synonyms';
import { conversionFactor, convertValue } from './units';

/**
 * Pairs analytes read out of a file with the parameters of the analyzers already defined.
 *
 * Names never arrive in the form they are stored in. A parameter labelled `Гемоглобин (HGB)` has to
 * be found from `Гемоглобин`, from `HGB`, and from `Гемаглобин` with the OCR's missing stroke — so
 * each side is reduced to a set of variants and compared by edit distance, with the parenthetical
 * abbreviation treated as a name in its own right.
 *
 * Matching runs per analyzer rather than assigning each analyte a single global winner. One file
 * commonly covers both ОАК and биохимия, and глюкоза legitimately belongs to both; a global
 * assignment would fill whichever analyzer it reached first and leave the other short.
 */

export interface AnalyteMatch {
  param: LabParameter;
  analyte: ParsedAnalyte;
  score: number;
  /**
   * What actually goes into the field — the analyte's value expressed in the parameter's unit.
   * Equal to `analyte.value` unless the file used the other convention.
   */
  value: number;
  /** Set only when the value was rescaled, so the review screen can show the arithmetic. */
  conversion?: { from: string; to: string };
}

export interface TestFill {
  test: LabTestDefinition;
  matches: AnalyteMatch[];
}

export interface MatchPlan {
  fills: TestFill[];
  /** Analytes that matched nothing anywhere — the raw material for a new analyzer. */
  unmatched: ParsedAnalyte[];
  /**
   * Analytes whose only home is a computed parameter — `Нейтрофилы, абс.` against a field derived
   * from лейкоциты and the neutrophil percentage. Writing into one would be overwritten the moment
   * the form recalculates, so they are not imported; listing them apart from `unmatched` is what
   * stops five correctly handled rows from reading as five failures.
   */
  derived: ParsedAnalyte[];
}

/** Below this, agreement is coincidence. Tuned so `Гемоглобин`/`Гемоглабин` passes and `Глюкоза`/`Глобулин` does not. */
const MATCH_THRESHOLD = 0.82;

/** Shorter than this, containment proves nothing — `СРБ` sits inside plenty of unrelated words. */
const MIN_CONTAINMENT_LENGTH = 4;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/g, ' ')
    .trim();
}

/** `Билирубин общий` and `Общий билирубин` are the same name in a different order. */
function sortWords(text: string): string {
  return text.split(' ').filter(Boolean).sort().join(' ');
}

/**
 * Cyrillic letters that are drawn identically to a Latin one. Laboratory software mixes the two
 * constantly — the ПМТ form prints `рH` with a Cyrillic `р` — and the two strings are then equal on
 * paper and unequal to every comparison.
 *
 * Applied to both sides as an extra variant, never as a replacement: a Russian word folds to the
 * same nonsense on both sides, so nothing that used to match stops matching.
 */
const CONFUSABLES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o',
  р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i',
};

function fold(text: string): string {
  return [...text].map((char) => CONFUSABLES[char] ?? char).join('');
}

/**
 * The analyser's own code, which some forms give a column of its own — `PRO Белок`, `SG Удельный
 * вес`. It merges into the name when the row is reassembled, and swamps a short one like `pH`.
 */
const LEADING_CODE = /^[a-z]{2,6}\d?\s+(?=\S)/;

/**
 * Тот же код, но снятый **до** приведения к нижнему регистру — и потому кириллический тоже.
 *
 * Распознавание читает `RBC` как `ВВС`, `pH` как `РН`, `SQEP` как `ЗОЕР`: латинские буквы кода
 * подменяются кириллическими двойниками. После `normalize` отличить такой код от обычного русского
 * слова уже нечем, а до него — можно: код набран **целиком прописными**, слово — нет. Правило
 * поэтому смотрит на исходный текст и требует, чтобы прописными были все буквы кода: «Белок общий»
 * так не срежется, а «ВВС Эритроциты» — срежется.
 */
const UPPERCASE_CODE = /^[A-ZА-ЯЁ][A-ZА-ЯЁ0-9]{1,5}[.\s]+(?=\S)/;

/**
 * The name itself, the name without its bracketed abbreviation, that abbreviation alone, each of
 * those with its words sorted, and every known synonym of the lot.
 */
function variants(text: string): string[] {
  const seeds = new Set<string>();
  const whole = normalize(text);
  if (whole) seeds.add(whole);

  const withoutBrackets = normalize(text.replace(/[([{].*?[)\]}]/g, ' '));
  if (withoutBrackets) seeds.add(withoutBrackets);

  const withoutCode = normalize(text.replace(UPPERCASE_CODE, ''));
  if (withoutCode) seeds.add(withoutCode);

  for (const match of text.matchAll(/[([{](.*?)[)\]}]/g)) {
    const inner = normalize(match[1] ?? '');
    if (inner) seeds.add(inner);
  }

  // A name that opens with an analyser code is also tried without it.
  for (const seed of [...seeds]) {
    const withoutCode = seed.replace(LEADING_CODE, '');
    if (withoutCode && withoutCode !== seed) seeds.add(withoutCode);
  }

  const found = new Set<string>();
  for (const seed of seeds) {
    for (const synonym of expandSynonyms(seed)) {
      found.add(synonym);
      found.add(sortWords(synonym));
    }
    found.add(sortWords(seed));
    found.add(fold(seed));
  }
  return [...found];
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      // Обе строки заполнены до нужной длины на предыдущем круге — обращения в границах по
      // построению, и `?? 0` здесь читается как «этого не бывает», а не меняет расчёт.
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  // `Гемоглобин` inside `Гемоглобин ретикулоцитов` is a real match, but a weaker one than equality:
  // it must not outrank an analyzer that spells the parameter out exactly.
  if (shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter)) return 0.88;

  return 1 - editDistance(a, b) / longer.length;
}

/**
 * How the analyte's value must be rescaled to read correctly in the parameter's unit, or `null`
 * when the two units are not comparable at all.
 *
 * This is the guard that keeps an erythrocyte count out of a urine sediment field. `Эритроциты`
 * names a parameter in both ОАК and ОАМ, and by name alone the two are indistinguishable — but
 * `×10¹²/л` and `в п/зр` are not, and 4,85 arriving in a field whose normal is 0–2 reads as a
 * catastrophic result rather than the mis-filing it actually is.
 *
 * Silence on either side proves nothing, so an unstated unit scales by 1 rather than blocking.
 * What the guard must not do is read a different *notation* as disagreement: `тыс/мкл` and `×10⁹/л`
 * are one unit under two conventions, and vetoing that pairing threw away most of an Инвитро ОАК.
 * See `units.ts` for what is comparable to what, and for why molar conversions are left out.
 */
function unitScale(analyte: ParsedAnalyte, param: LabParameter): number | null {
  if (!analyte.unit || !param.unit) return 1;
  return conversionFactor(analyte.unit, param.unit);
}

/**
 * A graded or categorical parameter holds one of its own option values — `Не обнаружено` is 0,
 * `++` is 3. A measurement out of a blood count is none of them, so the pairing is refused
 * outright: a haemoglobin of 16.6 was landing in the urinalysis dipstick field `Эритроциты
 * (реакция на гемоглобин)`, which lists `Гемоглобин` among its aliases and states no unit, leaving
 * nothing else to stop it.
 */
function valueFitsParameter(analyte: ParsedAnalyte, param: LabParameter): boolean {
  if (param.inputType !== 'select' || !param.options?.length) return true;
  return param.options.some((option) => option.value === analyte.value);
}

function bestScore(analyte: ParsedAnalyte, param: LabParameter): number {
  if (unitScale(analyte, param) === null) return 0;
  if (!valueFitsParameter(analyte, param)) return 0;

  // A parameter's own aliases are the doctor's answer for names no shared list could know — a local
  // laboratory's wording, or an analyte they added themselves.
  const paramVariants = [
    ...variants(param.label),
    ...(param.aliases ?? []).flatMap(variants),
    normalize(param.key),
  ];
  const analyteVariants = variants(analyte.name);

  let best = 0;
  for (const left of analyteVariants) {
    for (const right of paramVariants) {
      best = Math.max(best, similarity(left, right));
      if (best === 1) return 1;
    }
  }
  return best;
}

export function matchAnalytes(analytes: ParsedAnalyte[], tests: LabTestDefinition[]): MatchPlan {
  const usedAnywhere = new Set<ParsedAnalyte>();
  const fills: TestFill[] = [];

  const claimedByDerived = new Set<ParsedAnalyte>();

  for (const test of tests) {
    const candidates: AnalyteMatch[] = [];
    for (const param of test.parameters) {
      // Derived parameters are computed from the others; writing into one would be overwritten.
      if (param.inputType === 'derived') {
        for (const analyte of analytes) {
          if (bestScore(analyte, param) >= MATCH_THRESHOLD) claimedByDerived.add(analyte);
        }
        continue;
      }
      for (const analyte of analytes) {
        const score = bestScore(analyte, param);
        if (score < MATCH_THRESHOLD) continue;
        // Non-null: bestScore already refused the pairing otherwise.
        const factor = unitScale(analyte, param) as number;
        candidates.push({
          param,
          analyte,
          score,
          value: convertValue(analyte.value, factor),
          ...(factor !== 1 && analyte.unit && param.unit
            ? { conversion: { from: analyte.unit, to: param.unit } }
            : {}),
        });
      }
    }

    // Greedy by confidence: the strongest pairing claims its analyte and its parameter, so a single
    // value cannot land in two parameters of the same analyzer.
    candidates.sort((a, b) => b.score - a.score);
    const takenParams = new Set<string>();
    const takenAnalytes = new Set<ParsedAnalyte>();
    const matches: AnalyteMatch[] = [];
    for (const candidate of candidates) {
      if (takenParams.has(candidate.param.key) || takenAnalytes.has(candidate.analyte)) continue;
      takenParams.add(candidate.param.key);
      takenAnalytes.add(candidate.analyte);
      matches.push(candidate);
      usedAnywhere.add(candidate.analyte);
    }

    if (matches.length > 0) {
      matches.sort(
        (a, b) => test.parameters.indexOf(a.param) - test.parameters.indexOf(b.param),
      );
      fills.push({ test, matches });
    }
  }

  fills.sort((a, b) => b.matches.length - a.matches.length);
  const leftOver = analytes.filter((analyte) => !usedAnywhere.has(analyte));
  return {
    fills,
    unmatched: leftOver.filter((analyte) => !claimedByDerived.has(analyte)),
    derived: leftOver.filter((analyte) => claimedByDerived.has(analyte)),
  };
}
