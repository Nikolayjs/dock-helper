import { FREQUENCY_PROBABILITY } from './types';
import type { Disease, Questionnaire, Symptom, SymptomFrequency } from './types';

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

export interface SymptomGain {
  symptom: Symptom;
  gain: number;
}

const MIN_USEFUL_GAIN = 0.02;

/**
 * Неотвеченные признаки по ожидаемому приросту информации — то есть по тому, насколько сильно
 * ответ на них, в среднем, сузит круг версий.
 *
 * **Один расчёт на оба режима, и это несущее.** Опрос берёт отсюда первый признак, выбор симптомов
 * — верхушку списка для подсказки «что ещё уточнить». Второй расчёт того же самого разошёлся бы с
 * первым на первой правке, и получилось бы два движка, по-разному отвечающих на один вопрос:
 * подсказка обещала бы одно, а опрос спрашивал другое.
 */
export function rankSymptomsByGain(
  diseases: Disease[],
  symptoms: Symptom[],
  posteriors: Record<string, number>,
  excludedSymptomIds: Set<string>,
): SymptomGain[] {
  const candidates = symptoms.filter((s) => !excludedSymptomIds.has(s.id));
  if (candidates.length === 0 || diseases.length === 0) return [];

  const currentEntropy = entropy(diseases.map((d) => posteriors[d.id] ?? 0));

  return candidates
    .map((symptom) => {
      const pYes = diseases.reduce((sum, d) => sum + (posteriors[d.id] ?? 0) * symptomProbability(d, symptom), 0);
      const pNo = 1 - pYes;

      let entropyAfter = currentEntropy;
      if (pYes > 1e-9 && pNo > 1e-9) {
        const postYes = diseases.map((d) => ((posteriors[d.id] ?? 0) * symptomProbability(d, symptom)) / pYes);
        const postNo = diseases.map((d) => ((posteriors[d.id] ?? 0) * (1 - symptomProbability(d, symptom))) / pNo);
        entropyAfter = pYes * entropy(postYes) + pNo * entropy(postNo);
      }

      return { symptom, gain: currentEntropy - entropyAfter };
    })
    .filter((c) => c.gain >= MIN_USEFUL_GAIN)
    .sort((a, b) => b.gain - a.gain);
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
  return rankSymptomsByGain(diseases, symptoms, posteriors, excludedSymptomIds)[0]?.symptom ?? null;
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

/**
 * Вероятность признака «в среднем по панели» — то, с чем сравнивается отдельное заболевание.
 *
 * Взвешивается приорами, а не считается простым средним: панель из двенадцати редкостей и одной
 * банальности иначе объявила бы банальность «необычной» — её признаки встречались бы реже
 * «среднего по списку», хотя именно она и приходит на приём чаще всех.
 */
function fieldProbability(diseases: Disease[], symptom: Symptom): number {
  const weight = (d: Disease) => Math.max(d.priorWeight, 0.0001);
  const total = diseases.reduce((sum, d) => sum + weight(d), 0);
  if (total <= 0) return 0.5;
  return diseases.reduce((sum, d) => sum + weight(d) * symptomProbability(d, symptom), 0) / total;
}

export type FindingDirection = 'for' | 'against' | 'neutral';

export interface Finding {
  symptom: Symptom;
  answer: Answer;
  /** Частота этого признака у этого заболевания — та самая, что стоит в матрице панели. */
  frequency: SymptomFrequency | null;
  /** Во сколько раз этот ответ поднял (или опустил) шансы заболевания против остальных версий. */
  lift: number;
  direction: FindingDirection;
}

/**
 * Порог, за которым признак считается различающим.
 *
 * Полуторакратное изменение шансов — это примерно граница, за которой один признак ещё способен
 * что-то решить в списке из десятка версий. Ниже неё признак есть у всех подряд, и называть его
 * доводом значило бы выдавать за находку то, что не сузило круг ни на сколько.
 */
const LIFT_FOR = 1.5;
const LIFT_AGAINST = 1 / LIFT_FOR;

/**
 * Чем отмеченные признаки говорят за это заболевание и чем против.
 *
 * **Считается сравнением с остальными версиями, а не по самой частоте, и это несущее.** Признак,
 * который при этом заболевании бывает «часто», не говорит за него ничего, если при всех прочих
 * бывает «всегда»: разделяет версии не частота, а разница частот. Показывать «Температура 38 °C —
 * часто» доводом в пользу ангины среди двенадцати лихорадочных болезней значило бы объяснять
 * диагноз тем, что одинаково верно для всего списка.
 *
 * Отсюда и третья корзина: признаки, которые не различают вовсе. Их не прячут — врач отметил их
 * сам и вправе знать, что они не сдвинули ничего, а не искать глазами, куда они делись.
 */
export function explainCandidate(
  disease: Disease,
  diseases: Disease[],
  symptoms: Symptom[],
  answers: Record<string, Answer>,
): Finding[] {
  const findings: Finding[] = [];

  for (const symptom of symptoms) {
    const answer = answers[symptom.id];
    if (!answer) continue;

    const own = symptomProbability(disease, symptom);
    const field = fieldProbability(diseases, symptom);
    const lift = answer === 'yes' ? own / field : (1 - own) / (1 - field);

    findings.push({
      symptom,
      answer,
      frequency: disease.symptomLinks.find((l) => l.symptomId === symptom.id)?.frequency ?? null,
      lift,
      direction: lift >= LIFT_FOR ? 'for' : lift <= LIFT_AGAINST ? 'against' : 'neutral',
    });
  }

  // Сильнее всего говорящее — первым, в обе стороны: список доводов читают сверху и до тех пор,
  // пока они что-то значат.
  return findings.sort((a, b) => {
    const order = { for: 0, neutral: 2, against: 1 } as const;
    if (order[a.direction] !== order[b.direction]) return order[a.direction] - order[b.direction];
    return a.direction === 'against' ? a.lift - b.lift : b.lift - a.lift;
  });
}
