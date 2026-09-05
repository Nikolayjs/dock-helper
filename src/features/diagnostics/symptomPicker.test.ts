import { describe, expect, it } from 'vitest';

import { computePosteriors, explainCandidate, pickNextSymptom, rankSymptomsByGain } from './diagnosticEngine';
import type { Answer } from './diagnosticEngine';
import type { Disease, Symptom, SymptomFrequency } from './types';

/**
 * Режим «выбор симптомов»: то, из-за чего он мог бы врать молча.
 *
 * Разбор здесь строится не на вопросах движка, а на том, что отметил врач, — и обе главные ошибки
 * тихие: неотмеченный признак, принятый за отсутствующий, и довод «за», которым объявлен признак,
 * одинаково частый у всей панели.
 */
const symptom = (id: string, generalPrevalence = 0.3): Symptom => ({ id, label: id, generalPrevalence });

const disease = (
  id: string,
  links: { symptomId: string; frequency: SymptomFrequency }[],
  priorWeight = 1,
): Disease => ({ id, name: id, description: '', priorWeight, symptomLinks: links });

describe('неотмеченный признак ничего не значит', () => {
  it('отметка одного признака не считает остальные отсутствующими', () => {
    const symptoms = [symptom('a'), symptom('b'), symptom('c')];
    const diseases = [
      disease('with_bc', [
        { symptomId: 'a', frequency: 'sometimes' },
        { symptomId: 'b', frequency: 'always' },
        { symptomId: 'c', frequency: 'always' },
      ]),
      disease('with_a', [
        { symptomId: 'a', frequency: 'always' },
        { symptomId: 'b', frequency: 'never' },
        { symptomId: 'c', frequency: 'never' },
      ]),
    ];

    const marked = computePosteriors(diseases, symptoms, { a: 'yes' });
    // Если бы «не отмечено» читалось как «нет», то b и c пришли бы отрицательными и добили бы
    // `with_bc` до нуля: врач отметил один признак, а получил разбор, построенный на трёх.
    const asIfAllNo = computePosteriors(diseases, symptoms, { a: 'yes', b: 'no', c: 'no' });

    expect(marked.with_bc).toBeGreaterThan(asIfAllNo.with_bc);
    expect(marked.with_bc).toBeGreaterThan(0.1);
  });
});

describe('довод считается сравнением с остальными версиями', () => {
  const symptoms = [symptom('fever'), symptom('rash')];
  // Лихорадка есть у обеих версий, сыпь — только у первой.
  const diseases = [
    disease('rashy', [
      { symptomId: 'fever', frequency: 'always' },
      { symptomId: 'rash', frequency: 'often' },
    ]),
    disease('plain', [
      { symptomId: 'fever', frequency: 'always' },
      { symptomId: 'rash', frequency: 'never' },
    ]),
  ];
  const answers: Record<string, Answer> = { fever: 'yes', rash: 'yes' };

  it('признак, одинаково частый у всех версий, доводом не считается', () => {
    const findings = explainCandidate(diseases[0], diseases, symptoms, answers);
    const fever = findings.find((f) => f.symptom.id === 'fever');
    expect(fever?.direction).toBe('neutral');
  });

  it('различающий признак назван доводом за, и в обе стороны', () => {
    const forRashy = explainCandidate(diseases[0], diseases, symptoms, answers);
    expect(forRashy.find((f) => f.symptom.id === 'rash')?.direction).toBe('for');

    const forPlain = explainCandidate(diseases[1], diseases, symptoms, answers);
    expect(forPlain.find((f) => f.symptom.id === 'rash')?.direction).toBe('against');
  });

  it('в разбор попадает только отмеченное', () => {
    const findings = explainCandidate(diseases[0], diseases, symptoms, { rash: 'yes' });
    expect(findings.map((f) => f.symptom.id)).toEqual(['rash']);
  });

  it('доводы «за» идут первыми и сильнейшим вперёд', () => {
    const findings = explainCandidate(diseases[0], diseases, symptoms, answers);
    expect(findings[0].symptom.id).toBe('rash');
  });
});

describe('подсказка «что ещё уточнить» — тот же расчёт, что и опрос', () => {
  const symptoms = [symptom('a'), symptom('b'), symptom('c')];
  const diseases = [
    disease('x', [
      { symptomId: 'a', frequency: 'always' },
      { symptomId: 'b', frequency: 'sometimes' },
      { symptomId: 'c', frequency: 'sometimes' },
    ]),
    disease('y', [
      { symptomId: 'a', frequency: 'never' },
      { symptomId: 'b', frequency: 'sometimes' },
      { symptomId: 'c', frequency: 'sometimes' },
    ]),
  ];

  it('верхушка списка — ровно тот признак, который спросил бы опрос', () => {
    const posteriors = computePosteriors(diseases, symptoms, {});
    const excluded = new Set<string>();
    const ranked = rankSymptomsByGain(diseases, symptoms, posteriors, excluded);
    expect(ranked[0]?.symptom.id).toBe(pickNextSymptom(diseases, symptoms, posteriors, excluded)?.id);
  });

  it('уже отмеченное больше не предлагается', () => {
    const answers = { a: 'yes' as const };
    const posteriors = computePosteriors(diseases, symptoms, answers);
    const ranked = rankSymptomsByGain(diseases, symptoms, posteriors, new Set(Object.keys(answers)));
    expect(ranked.map((r) => r.symptom.id)).not.toContain('a');
  });

  it('бесполезные признаки в подсказку не попадают вовсе', () => {
    // b и c одинаковы у обеих версий: спрашивать о них нечего, и предлагать их — тоже.
    const posteriors = computePosteriors(diseases, symptoms, { a: 'yes' });
    const ranked = rankSymptomsByGain(diseases, symptoms, posteriors, new Set(['a']));
    expect(ranked).toHaveLength(0);
  });
});
