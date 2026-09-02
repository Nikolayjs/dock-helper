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

  it('разрыв назван: возраст без своей полосы считается приблизительно', () => {
    const [first] = ageBandWarnings([band('a', 0, 12), band('b', 14, 18)]);
    expect(first).toContain('12–14');
    expect(first).toContain('приблизительно');
  });

  it('стык-в-стык и открытая верхняя полоса — молча', () => {
    expect(ageBandWarnings([band('a', 0, 12), band('b', 12, 18), band('c', 18)])).toEqual([]);
  });

  it('полоса без границ съедает все следующие', () => {
    expect(ageBandWarnings([band('a'), band('b', 18)])[0]).toContain('не сработают никогда');
  });

  it('перевёрнутая полоса в сравнение не идёт: о ней говорит проверка формы', () => {
    expect(ageBandWarnings([band('a', 18, 5), band('b', 0, 18)])).toEqual([]);
  });
});
