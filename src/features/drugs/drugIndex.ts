import type { Drug } from './types';

/**
 * The name index that lets the interaction check and the directory talk about the same drug.
 *
 * A patient does not bring in «Ибупрофен», they bring in a box that says «Нурофен» — and every
 * interaction rule is written on the МНН. Without a mapping between the two, the doctor types what
 * the patient told them and the warfarin warning silently does not fire. That is the failure this
 * file exists to prevent, so it resolves trade names to МНН before anything is matched.
 */

/**
 * `ё`/`е` are interchangeable in practice and nobody types the accented one consistently; case and
 * inner spacing vary by whoever entered the row. Everything else is left alone — trade names are
 * legally registered strings and guessing at typos would be a different, riskier feature.
 */
export function normalizeDrugName(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export interface DrugIndex {
  /** Normalized МНН *and* every trade name → the МНН. */
  innByName: Map<string, string>;
  /** Normalized МНН → the directory entry. */
  byInn: Map<string, Drug>;
}

export function buildDrugIndex(drugs: Drug[]): DrugIndex {
  const innByName = new Map<string, string>();
  const byInn = new Map<string, Drug>();

  for (const drug of drugs) {
    const inn = normalizeDrugName(drug.inn);
    if (!inn) continue;
    byInn.set(inn, drug);
    innByName.set(inn, inn);
    for (const brand of drug.brandNames) {
      const key = normalizeDrugName(brand);
      // First entry wins: a trade name claimed by two МНН is a data error, and silently
      // reassigning it to whichever drug was saved last would move interactions with it.
      if (key && !innByName.has(key)) innByName.set(key, inn);
    }
  }

  return { innByName, byInn };
}

export interface ResolvedDrug {
  /** Exactly what the doctor typed. */
  entered: string;
  /** The МНН the check will use — falls back to the entered text when the drug is unknown. */
  inn: string;
  /** The directory entry, when there is one. */
  drug: Drug | null;
  /** True when the entered text was a trade name, i.e. the МНН shown is not what was typed. */
  viaBrandName: boolean;
}

export function resolveDrug(entered: string, index: DrugIndex): ResolvedDrug {
  const key = normalizeDrugName(entered);
  const inn = index.innByName.get(key);

  if (!inn) return { entered, inn: key, drug: null, viaBrandName: false };

  const drug = index.byInn.get(inn) ?? null;
  return { entered, inn, drug, viaBrandName: inn !== key };
}

/**
 * Autocomplete entries for the drug picker: every МНН and every trade name, each on its own, so
 * the doctor finds the drug under whichever name they know it by.
 */
export function drugNameOptions(drugs: Drug[]): string[] {
  const names = new Set<string>();
  for (const drug of drugs) {
    if (drug.inn.trim()) names.add(drug.inn.trim());
    for (const brand of drug.brandNames) {
      if (brand.trim()) names.add(brand.trim());
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Distinct pharmacological groups, for the directory's group filter. */
export function drugGroups(drugs: Drug[]): string[] {
  const groups = new Set<string>();
  for (const drug of drugs) {
    const group = drug.pharmGroup.trim();
    if (group) groups.add(group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b, 'ru'));
}

/** Matches a drug against a free-text query across МНН, trade names, group and ATC code. */
export function drugMatchesQuery(drug: Drug, query: string): boolean {
  const q = normalizeDrugName(query);
  if (!q) return true;
  const haystack = [drug.inn, ...drug.brandNames, drug.pharmGroup, drug.atcCode].map(normalizeDrugName);
  return haystack.some((value) => value.includes(q));
}
