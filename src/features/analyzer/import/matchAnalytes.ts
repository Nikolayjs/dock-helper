import type { LabParameter, LabTestDefinition } from '../types';
import type { ParsedAnalyte } from './parseLabValues';
import { expandSynonyms } from './synonyms';

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
}

export interface TestFill {
  test: LabTestDefinition;
  matches: AnalyteMatch[];
}

export interface MatchPlan {
  fills: TestFill[];
  /** Analytes that matched nothing anywhere — the raw material for a new analyzer. */
  unmatched: ParsedAnalyte[];
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
 * The name itself, the name without its bracketed abbreviation, that abbreviation alone, each of
 * those with its words sorted, and every known synonym of the lot.
 */
function variants(text: string): string[] {
  const seeds = new Set<string>();
  const whole = normalize(text);
  if (whole) seeds.add(whole);

  const withoutBrackets = normalize(text.replace(/[([{].*?[)\]}]/g, ' '));
  if (withoutBrackets) seeds.add(withoutBrackets);

  for (const match of text.matchAll(/[([{](.*?)[)\]}]/g)) {
    const inner = normalize(match[1]);
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
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
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

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
};

/** `×10¹²/л`, `10^12/л` and `10*12/л` are the same unit written three ways; all reduce to `1012/л`. */
function normalizeUnit(unit: string): string {
  return [...unit.toLowerCase().replace(/ё/g, 'е')]
    .map((char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .join('')
    .replace(/[\s×*^]/g, '');
}

/**
 * Rejects a pairing whose units disagree.
 *
 * This is the guard that keeps an erythrocyte count out of a urine sediment field. `Эритроциты`
 * names a parameter in both ОАК and ОАМ, and by name alone the two are indistinguishable — but
 * `×10¹²/л` and `в п/зр` are not, and 4,85 arriving in a field whose normal is 0–2 reads as a
 * catastrophic result rather than the mis-filing it actually is.
 *
 * Silence on either side proves nothing, so only two stated and differing units block a match.
 */
function unitsConflict(analyte: ParsedAnalyte, param: LabParameter): boolean {
  if (!analyte.unit || !param.unit) return false;
  return normalizeUnit(analyte.unit) !== normalizeUnit(param.unit);
}

function bestScore(analyte: ParsedAnalyte, param: LabParameter): number {
  if (unitsConflict(analyte, param)) return 0;

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

  for (const test of tests) {
    const candidates: AnalyteMatch[] = [];
    for (const param of test.parameters) {
      // Derived parameters are computed from the others; writing into one would be overwritten.
      if (param.inputType === 'derived') continue;
      for (const analyte of analytes) {
        const score = bestScore(analyte, param);
        if (score >= MATCH_THRESHOLD) candidates.push({ param, analyte, score });
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
  return { fills, unmatched: analytes.filter((analyte) => !usedAnywhere.has(analyte)) };
}
