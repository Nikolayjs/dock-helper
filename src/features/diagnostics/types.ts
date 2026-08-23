export interface Symptom {
  id: string;
  label: string;
  /** Fallback probability (0-1) that this symptom is present, used for diseases that don't explicitly link it. */
  generalPrevalence: number;
}

export type SymptomFrequency = 'never' | 'rarely' | 'sometimes' | 'often' | 'always';

export const FREQUENCY_PROBABILITY: Record<SymptomFrequency, number> = {
  never: 0.02,
  rarely: 0.1,
  sometimes: 0.4,
  often: 0.7,
  always: 0.95,
};

export const FREQUENCY_LABELS: Record<SymptomFrequency, string> = {
  never: 'Никогда',
  rarely: 'Редко',
  sometimes: 'Иногда',
  often: 'Часто',
  always: 'Всегда',
};

export interface DiseaseSymptomLink {
  symptomId: string;
  frequency: SymptomFrequency;
}

export interface Disease {
  id: string;
  name: string;
  description: string;
  /** Relative prior weight before any symptoms are answered (default 1 = equal to others). */
  priorWeight: number;
  symptomLinks: DiseaseSymptomLink[];
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  symptoms: Symptom[];
  diseases: Disease[];
  createdAt: string;
  updatedAt: string;
}
