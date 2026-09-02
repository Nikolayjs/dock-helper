import { describe, expect, it } from 'vitest';

import { computePosteriors, symptomProbability } from './diagnosticEngine';
import type { Disease, Symptom } from './types';

/**
 * Байесовский движок панелей: проверяется то, из-за чего он молча обнулялся.
 *
 * Слайдер в конструкторе допускает ровно 0 % и 100 %, а множитель ноль убивает заболевание
 * навсегда: `total` становится нулём, и вместо ответа появляется равномерное распределение.
 */
const symptom = (id: string, generalPrevalence = 0.3): Symptom => ({ id, label: id, generalPrevalence });

const disease = (id: string, links: { symptomId: string; frequency: 'never' | 'always' | 'often' }[]): Disease => ({
  id,
  name: id,
  description: '',
  priorWeight: 1,
  symptomLinks: links,
});

describe('вероятность симптома зажата', () => {
  it('«никогда» — это не ноль, а «почти никогда»', () => {
    const p = symptomProbability(disease('d', [{ symptomId: 's', frequency: 'never' }]), symptom('s'));
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.05);
  });

  it('нулевая частота из конструктора не обнуляет всё распределение', () => {
    const diseases = [disease('a', [{ symptomId: 's', frequency: 'never' }]), disease('b', [{ symptomId: 's', frequency: 'often' }])];
    // Симптом, у которого и общая частота выставлена в ноль: раньше это давало ноль у обоих.
    const posteriors = computePosteriors(diseases, [symptom('s', 0)], { s: 'yes' });

    expect(posteriors.a + posteriors.b).toBeCloseTo(1, 6);
    // Ответ «да» на симптом, которого у «a» «никогда» не бывает, обязан говорить в пользу «b»,
    // а не превращаться в «обе одинаково вероятны».
    expect(posteriors.b).toBeGreaterThan(posteriors.a);
  });

  it('ответ «нет» на всегдашний симптом тоже не обнуляет версию окончательно', () => {
    const diseases = [disease('a', [{ symptomId: 's', frequency: 'always' }]), disease('b', [{ symptomId: 's', frequency: 'often' }])];
    const posteriors = computePosteriors(diseases, [symptom('s')], { s: 'no' });
    expect(posteriors.a).toBeGreaterThan(0);
    expect(posteriors.a).toBeLessThan(posteriors.b);
  });
});
