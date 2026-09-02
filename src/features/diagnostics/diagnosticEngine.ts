import { FREQUENCY_PROBABILITY } from './types';
import type { Disease, Questionnaire, Symptom } from './types';

export type Answer = 'yes' | 'no';

/**
 * P(symptom present | disease) — the disease's explicit frequency, or the symptom's general fallback.
 *
 * Вероятность зажимается в 1–99 %, и это не косметика. Слайдер в конструкторе допускает ровно 0 и
 * 100, а множитель ноль **обнуляет заболевание навсегда**: один ответ «да» на симптом с частотой 0 %
 * убивает все версии сразу, `total` становится нулём, и на экране появляется равномерное
 * распределение — то есть движок отвечает «все болезни одинаково вероятны» и не говорит почему.
 * Так же зажат `priorWeight` строкой ниже, и по той же причине.
 *
 * Клинически это тоже честнее: «никогда» и «всегда» в медицине означают «почти никогда» и «почти
 * всегда», и один ответ пациента не должен закрывать диагноз окончательно.
 */
export function symptomProbability(disease: Disease, symptom: Symptom): number {
  const link = disease.symptomLinks.find((l) => l.symptomId === symptom.id);
  const raw = link ? FREQUENCY_PROBABILITY[link.frequency] : symptom.generalPrevalence;
  return Math.min(0.99, Math.max(0.01, raw));
}

export interface Candidate {
  disease: Disease;
  probability: number;
}

/** Naive-Bayes posterior over diseases given the answers collected so far. */
export function computePosteriors(
  diseases: Disease[],
  symptoms: Symptom[],
  answers: Record<string, Answer>,
): Record<string, number> {
  const symptomById = new Map(symptoms.map((s) => [s.id, s]));
  const scores: Record<string, number> = {};

  for (const disease of diseases) {
    let score = Math.max(disease.priorWeight, 0.0001);
    for (const [symptomId, answer] of Object.entries(answers)) {
      const symptom = symptomById.get(symptomId);
      if (!symptom) continue;
      const p = symptomProbability(disease, symptom);
      score *= answer === 'yes' ? p : 1 - p;
    }
    scores[disease.id] = score;
  }

  const total = Object.values(scores).reduce((sum, v) => sum + v, 0);
  if (total <= 0) {
    const uniform = 1 / diseases.length;
    return Object.fromEntries(diseases.map((d) => [d.id, uniform]));
  }
  return Object.fromEntries(Object.entries(scores).map(([id, v]) => [id, v / total]));
}

function entropy(distribution: number[]): number {
  return -distribution.reduce((sum, p) => (p > 0 ? sum + p * Math.log2(p) : sum), 0);
}

/**
 * Picks the unanswered symptom that maximizes expected information gain
 * (the classic 20-questions strategy: the question whose answer, on average,
 * narrows the field the most).
 */
export function pickNextSymptom(
  diseases: Disease[],
  symptoms: Symptom[],
  posteriors: Record<string, number>,
  excludedSymptomIds: Set<string>,
): Symptom | null {
  const candidates = symptoms.filter((s) => !excludedSymptomIds.has(s.id));
  if (candidates.length === 0 || diseases.length === 0) return null;

  const currentEntropy = entropy(diseases.map((d) => posteriors[d.id] ?? 0));
  let best: { symptom: Symptom; gain: number } | null = null;

  for (const symptom of candidates) {
    const pYes = diseases.reduce((sum, d) => sum + (posteriors[d.id] ?? 0) * symptomProbability(d, symptom), 0);
    const pNo = 1 - pYes;

    let entropyAfter = currentEntropy;
    if (pYes > 1e-9 && pNo > 1e-9) {
      const postYes = diseases.map((d) => ((posteriors[d.id] ?? 0) * symptomProbability(d, symptom)) / pYes);
      const postNo = diseases.map((d) => ((posteriors[d.id] ?? 0) * (1 - symptomProbability(d, symptom))) / pNo);
      entropyAfter = pYes * entropy(postYes) + pNo * entropy(postNo);
    }

    const gain = currentEntropy - entropyAfter;
    if (!best || gain > best.gain) best = { symptom, gain };
  }

  const MIN_USEFUL_GAIN = 0.02;
  if (!best || best.gain < MIN_USEFUL_GAIN) return null;
  return best.symptom;
}

export function getRankedCandidates(diseases: Disease[], posteriors: Record<string, number>): Candidate[] {
  return [...diseases]
    .map((disease) => ({ disease, probability: posteriors[disease.id] ?? 0 }))
    .sort((a, b) => b.probability - a.probability);
}

export interface ConfidenceCheck {
  isConfident: boolean;
  leader: Candidate | null;
  runnerUp: Candidate | null;
}

const CONFIDENCE_THRESHOLD = 0.7;
const SEPARATION_RATIO = 3;

export function checkConfidence(ranked: Candidate[]): ConfidenceCheck {
  const [leader, runnerUp] = ranked;
  if (!leader) return { isConfident: false, leader: null, runnerUp: null };
  const isConfident =
    leader.probability >= CONFIDENCE_THRESHOLD && (!runnerUp || leader.probability >= runnerUp.probability * SEPARATION_RATIO);
  return { isConfident, leader, runnerUp: runnerUp ?? null };
}

export function initialPosteriors(diseases: Disease[]): Record<string, number> {
  return computePosteriors(diseases, [], {});
}

export function toQuestionnaireSummary(q: Pick<Questionnaire, 'diseases' | 'symptoms'>) {
  return { diseaseCount: q.diseases.length, symptomCount: q.symptoms.length };
}
