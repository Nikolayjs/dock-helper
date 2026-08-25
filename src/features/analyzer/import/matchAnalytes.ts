import type { LabParameter, LabTestDefinition } from '../types';
import type { ParsedAnalyte } from './parseLabValues';

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

/** The name itself, the name without its bracketed abbreviation, and that abbreviation alone. */
function variants(text: string): string[] {
  const found = new Set<string>();
  const whole = normalize(text);
  if (whole) found.add(whole);

  const withoutBrackets = normalize(text.replace(/[([{].*?[)\]}]/g, ' '));
  if (withoutBrackets) found.add(withoutBrackets);

  for (const match of text.matchAll(/[([{](.*?)[)\]}]/g)) {
    const inner = normalize(match[1]);
    if (inner) found.add(inner);
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

  const paramVariants = [...variants(param.label), normalize(param.key)];
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
