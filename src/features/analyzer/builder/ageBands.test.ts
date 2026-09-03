import { describe, expect, it } from 'vitest';

import { ageBandWarnings } from './ageBands';
import type { CustomAgeBand } from '../customTypes';

const band = (id: string, minAge?: number, maxAge?: number): CustomAgeBand => ({ id, minAge, maxAge });

describe('возрастные полосы анализатора', () => {
  it('перекрытие названо: тринадцатилетний всегда получит первую полосу', () => {
    const [first] = ageBandWarnings([band('a', 0, 14), band('b', 12, 18)]);
    expect(first).toContain('перекрываются');
    expect(first).toContain('12–14');
  });

  it('разрыв в один год назван этим годом, а не диапазоном', () => {
    const [first] = ageBandWarnings([band('a', 0, 12), band('b', 14, 18)]);
    expect(first).toContain('13 лет');
    expect(first).toContain('приблизительно');
  });

  /*
   * Обе границы включающие, поэтому «0–14» и «14–18» — это перекрытие, а не стык: четырнадцатилетний
   * попадает в обе. Раньше сравнение было строгим, и самый частый способ записать полосы проходил
   * молча — то есть вторая норма не работала, а сказать об этом было некому.
   */
  it('«0–14 / 14–18» — перекрытие: включающие границы делят четырнадцать лет на двоих', () => {
    const [first] = ageBandWarnings([band('a', 0, 14), band('b', 14, 18)]);
    expect(first).toContain('перекрываются');
    expect(first).toContain('14 годах');
  });

  it('«0–14 / 15–18» — ни перекрытия, ни разрыва: полосы идут подряд', () => {
    expect(ageBandWarnings([band('a', 0, 14), band('b', 15, 18)])).toEqual([]);
  });

  it('«0–12 / 15–18» — разрыв, и назван теми годами, для которых нормы нет', () => {
    const [first] = ageBandWarnings([band('a', 0, 12), band('b', 15, 18)]);
    expect(first).toContain('13–14 лет');
    expect(first).toContain('приблизительно');
  });

  it('открытая верхняя полоса подряд с предыдущей — молча', () => {
    expect(ageBandWarnings([band('a', 0, 12), band('b', 13, 17), band('c', 18)])).toEqual([]);
  });

  it('полоса без границ съедает все следующие', () => {
    expect(ageBandWarnings([band('a'), band('b', 18)])[0]).toContain('не сработают никогда');
  });

  it('перевёрнутая полоса в сравнение не идёт: о ней говорит проверка формы', () => {
    expect(ageBandWarnings([band('a', 18, 5), band('b', 0, 18)])).toEqual([]);
  });
});
