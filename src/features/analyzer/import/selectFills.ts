import type { MatchPlan } from './matchAnalytes';

/** Below this an analyzer is more likely sharing a couple of common names than actually present in the file. */
const CONFIDENT_MATCH_COUNT = 3;

/** And below this share of the best-matching analyzer, it is riding on names that panel merely shares. */
const CONFIDENT_MATCH_SHARE = 0.4;

/**
 * Ticks the analyzers the file plausibly contains, and leaves the rest for the doctor to opt into.
 *
 * Глюкоза, белок and билирубин are all measured in both blood and urine, under the same names and
 * often the same units, so name matching alone cannot tell a urinalysis from a blood panel. What
 * can is proportion: a urinalysis form filled 32 of the urinalysis parameters and 3 of the
 * biochemistry ones, and those 3 were urine values about to be filed as blood chemistry — a urine
 * glucose of 0 reading as profound hypoglycaemia. One file is one specimen, so an analyzer trailing
 * far behind the leader is left for the doctor to tick deliberately.
 */
export function defaultSelection(plan: MatchPlan): string[] {
  const best = plan.fills[0]?.matches.length ?? 0;
  const confident = plan.fills.filter(
    (fill) => fill.matches.length >= CONFIDENT_MATCH_COUNT && fill.matches.length >= best * CONFIDENT_MATCH_SHARE,
  );
  if (confident.length > 0) return confident.map((fill) => fill.test.id);
  // Nothing reached the bar: fall back to the strongest single candidate rather than nothing at all.
  return plan.fills.slice(0, 1).map((fill) => fill.test.id);
}
