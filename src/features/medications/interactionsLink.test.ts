import { describe, expect, it } from 'vitest';

import { interactionsHref } from './interactionsLink';

const drugsOf = (href: string) => new URLSearchParams(href.split('?')[1]).get('drugs')?.split(',') ?? [];

describe('ссылка на проверку взаимодействий', () => {
  it('ведёт во вкладку взаимодействий и несёт весь список', () => {
    const href = interactionsHref(['Варфарин', 'Кардиомагнил']);
    expect(href.startsWith('/drugs?tab=interactions&drugs=')).toBe(true);
    expect(drugsOf(href)).toEqual(['Варфарин', 'Кардиомагнил']);
  });

  it('пустые строки не превращаются в пустые препараты', () => {
    expect(drugsOf(interactionsHref(['Варфарин', '  ', '']))).toEqual(['Варфарин']);
  });

  // Иначе один непонятный препарат стал бы двумя непонятными.
  it('запятая внутри названия не разрывает список', () => {
    expect(drugsOf(interactionsHref(['Сбор трав, растительный', 'Варфарин']))).toEqual([
      'Сбор трав растительный',
      'Варфарин',
    ]);
  });

  it('комбинация со слэшем едет целиком — её раскрывает сама проверка', () => {
    expect(drugsOf(interactionsHref(['Амоксициллин/клавуланат']))).toEqual(['Амоксициллин/клавуланат']);
  });
});
