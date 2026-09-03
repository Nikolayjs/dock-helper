import { describe, expect, it } from 'vitest';

import { MIN_TITLE_WIDTH, balanceSides } from './topbarBalance';

/**
 * Уравнивание сторон шапки.
 *
 * Проверяется прежде всего **устойчивость**: ширина стороны зависит от `min-width`, которую ставит
 * сам расчёт, а `ResizeObserver` будит его снова на каждое изменение. Расчёт, у которого результат
 * меняется от собственного результата, даёт автоколебание — в браузере это «периодически
 * появляется горизонтальный скролл», и руками такое почти не поймать.
 */
describe('уравнивание сторон шапки', () => {
  it('на телефоне не уравнивает ничего', () => {
    // Центральный заголовок там скрыт, а заголовок раздела стоит внутри левой группы и тянется:
    // `min-width` меняла бы ширину того самого элемента, по которому идёт замер.
    expect(balanceSides({ left: 300, right: 420, container: 390, compact: true })).toBe(0);
    expect(balanceSides({ left: 0, right: 0, container: 320, compact: true })).toBe(0);
  });

  it('на узком экране стороны сжимаются, а не защёлкиваются', () => {
    // 320 px: две стороны по 200 плюс заголовок в контейнер не помещаются ни при каком раскладе.
    expect(balanceSides({ left: 200, right: 240, container: 320, compact: false })).toBe(0);
  });

  it('на широком экране уравнивает по более широкой стороне', () => {
    expect(balanceSides({ left: 220, right: 340, container: 1400, compact: false })).toBe(340);
  });

  it('никогда не выходит за половину свободного места', () => {
    const container = 900;
    const result = balanceSides({ left: 380, right: 380, container, compact: false });
    expect(result).toBeLessThanOrEqual((container - MIN_TITLE_WIDTH) / 2);
  });

  it('повторный вызов с собственным результатом даёт то же значение', () => {
    // Именно этот случай и ломался: `min-width` раздувала сторону, следующий замер приходил
    // больше, и значение начинало ходить туда-обратно.
    const container = 1200;
    let value = balanceSides({ left: 300, right: 460, container, compact: false });
    for (let round = 0; round < 5; round++) {
      const next = balanceSides({ left: value, right: value, container, compact: false });
      expect(next).toBe(value);
      value = next;
    }
  });

  it('сходится и там, где содержимое шире половины контейнера', () => {
    const container = 700;
    const first = balanceSides({ left: 500, right: 500, container, compact: false });
    const second = balanceSides({ left: first, right: first, container, compact: false });
    expect(second).toBe(first);
  });

  it('контейнер без ширины — это ещё не измерение', () => {
    // Первый кадр до раскладки: ставить `min-width` по нулевому контейнеру нельзя.
    expect(balanceSides({ left: 300, right: 300, container: 0, compact: false })).toBe(0);
  });
});
