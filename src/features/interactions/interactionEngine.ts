import { buildDrugIndex, drugNameOptions, normalizeDrugName, resolveDrug } from '../drugs/drugIndex';
import type { DrugIndex, ResolvedDrug } from '../drugs/drugIndex';
import type { Drug } from '../drugs/types';
import { SEVERITY_RANK } from './types';
import type { DrugInteraction } from './types';

/**
 * The interaction check runs on МНН, and the doctor types whatever the patient said. Everything
 * here goes through the drug directory first (see `features/drugs/drugIndex`) so «Нурофен» and
 * «Ибупрофен» are one drug rather than two unrelated strings.
 *
 * A drug the directory does not know still works: it is matched on the text as typed, so the check
 * never becomes *less* capable than the directory is complete.
 */

export { buildDrugIndex };
export type { DrugIndex, ResolvedDrug };

/**
 * Names to offer in the picker: the whole formulary — МНН and trade names alike — plus any drug a
 * rule mentions that has no directory entry yet, so no existing rule becomes unreachable.
 */
export function getKnownDrugNames(drugs: Drug[], interactions: DrugInteraction[]): string[] {
  const names = drugNameOptions(drugs);
  const known = new Set(names.map(normalizeDrugName));
  const index = buildDrugIndex(drugs);

  for (const interaction of interactions) {
    for (const name of [interaction.drugA, interaction.drugB]) {
      const key = normalizeDrugName(name);
      if (!key || known.has(key) || index.innByName.has(key)) continue;
      known.add(key);
      names.push(name.trim());
    }
  }

  return names.sort((a, b) => a.localeCompare(b, 'ru'));
}

export interface MatchedInteraction {
  interaction: DrugInteraction;
  /** The entry from the doctor's list that matched `interaction.drugA`, resolved to its МНН. */
  a: ResolvedDrug;
  b: ResolvedDrug;
}

/**
 * Pairwise-matches the doctor's list against every known rule, order-independent.
 *
 * Duplicates collapse: entering both «Нурофен» and «Ибупрофен» is one drug, not a pair, and
 * reporting the same ibuprofen rule twice would make a real warning look like noise.
 */
export function checkInteractions(
  entered: string[],
  interactions: DrugInteraction[],
  index: DrugIndex,
): MatchedInteraction[] {
  const byInn = new Map<string, ResolvedDrug>();
  for (const name of entered) {
    const resolved = resolveDrug(name, index);
    if (!resolved.inn) continue;
    // Keep the first mention: it is the name the doctor reached for, and the alert echoes it back.
    if (!byInn.has(resolved.inn)) byInn.set(resolved.inn, resolved);
  }

  const matches: MatchedInteraction[] = [];
  for (const interaction of interactions) {
    const a = byInn.get(resolveDrug(interaction.drugA, index).inn);
    const b = byInn.get(resolveDrug(interaction.drugB, index).inn);
    if (a && b && a.inn !== b.inn) matches.push({ interaction, a, b });
  }

  return matches.sort((x, y) => SEVERITY_RANK[x.interaction.severity] - SEVERITY_RANK[y.interaction.severity]);
}

/** The doctor's list, resolved — drives the "what this was understood as" line under the picker. */
export function resolveEnteredDrugs(entered: string[], index: DrugIndex): ResolvedDrug[] {
  return entered.map((name) => resolveDrug(name, index));
}

/** Rules that mention this drug — shown on its card in the directory. */
export function interactionsForDrug(drug: Drug, interactions: DrugInteraction[], index: DrugIndex): DrugInteraction[] {
  const inn = normalizeDrugName(drug.inn);
  return interactions
    .filter((interaction) => {
      const a = resolveDrug(interaction.drugA, index).inn;
      const b = resolveDrug(interaction.drugB, index).inn;
      return a === inn || b === inn;
    })
    .sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
}

/** The other drug in a rule, given one side of it. */
export function otherDrugIn(interaction: DrugInteraction, drug: Drug, index: DrugIndex): string {
  const inn = normalizeDrugName(drug.inn);
  return resolveDrug(interaction.drugA, index).inn === inn ? interaction.drugB : interaction.drugA;
}
