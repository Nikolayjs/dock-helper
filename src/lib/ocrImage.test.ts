import { describe, expect, it } from 'vitest';

import { OCR_TARGET_WIDTH, removesRules, ruleThickness } from './ocrImage';

/**
 * Правило про линовку — замеренное, и потому проверяемое.
 *
 * Стирать рамки таблицы нужно ровно там, где они толще буквы: с 2000 px без этого распознавание
 * отдаёт ноль показателей, а на 800 px стирание само уносит **всю страницу** — буква там такой же
 * толщины, что и рамка. Цифры — в комментариях у `RULE_REMOVAL_MIN_WIDTH`.
 */
describe('подготовка картинки к распознаванию', () => {
  it('на мелкой картинке линовку не трогает', () => {
    expect(removesRules(800)).toBe(false);
    expect(removesRules(1200)).toBe(false);
  });

  it('на крупной — стирает: без этого там ноль', () => {
    expect(removesRules(1700)).toBe(true);
    expect(removesRules(2400)).toBe(true);
    expect(removesRules(OCR_TARGET_WIDTH)).toBe(true);
  });

  /*
   * Толщина, с которой сравнивается штрих, — доля ширины. Жёсткое число делало проверку «тонкий ли
   * штрих» верной для одной ширины и ложной для всех остальных.
   */
  it('толщина штриха растёт вместе с картинкой', () => {
    expect(ruleThickness(800)).toBe(3);
    expect(ruleThickness(1700)).toBe(3);
    expect(ruleThickness(2400)).toBe(4);
    expect(ruleThickness(4800)).toBe(8);
  });
});
