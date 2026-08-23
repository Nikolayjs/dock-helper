import { SEVERITY_RANK } from './types';
import type { DrugInteraction } from './types';

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Distinct drug names across all known interaction rows — feeds the picker's autocomplete. */
export function getKnownDrugNames(interactions: DrugInteraction[]): string[] {
  const names = new Set<string>();
  for (const interaction of interactions) {
    names.add(interaction.drugA);
    names.add(interaction.drugB);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
}

export interface MatchedInteraction {
  interaction: DrugInteraction;
  drugA: string;
  drugB: string;
}

/** Pairwise-matches the doctor's drug list against every known interaction rule, order-independent. */
export function checkInteractions(drugs: string[], interactions: DrugInteraction[]): MatchedInteraction[] {
  const normalized = new Set(drugs.map(normalize));
  const matches: MatchedInteraction[] = [];

  for (const interaction of interactions) {
    const a = normalize(interaction.drugA);
    const b = normalize(interaction.drugB);
    if (a !== b && normalized.has(a) && normalized.has(b)) {
      matches.push({ interaction, drugA: interaction.drugA, drugB: interaction.drugB });
    }
  }

  return matches.sort((x, y) => SEVERITY_RANK[x.interaction.severity] - SEVERITY_RANK[y.interaction.severity]);
}
