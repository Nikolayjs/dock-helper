export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  id: string;
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  mechanism: string;
  recommendation: string;
  createdAt: string;
  updatedAt: string;
}

export const SEVERITY_LABELS: Record<InteractionSeverity, string> = {
  contraindicated: 'Противопоказано',
  major: 'Серьёзное',
  moderate: 'Умеренное',
  minor: 'Незначительное',
};

export const SEVERITY_COLOR: Record<InteractionSeverity, string> = {
  contraindicated: 'red',
  major: 'orange',
  moderate: 'yellow',
  minor: 'gray',
};

/** Lower = more severe — used to sort results and to order the severity <Select>. */
export const SEVERITY_RANK: Record<InteractionSeverity, number> = {
  contraindicated: 0,
  major: 1,
  moderate: 2,
  minor: 3,
};

export const SEVERITY_OPTIONS: { value: InteractionSeverity; label: string }[] = (
  Object.keys(SEVERITY_LABELS) as InteractionSeverity[]
).map((value) => ({ value, label: SEVERITY_LABELS[value] }));
