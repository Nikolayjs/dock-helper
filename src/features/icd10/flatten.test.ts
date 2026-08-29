import { describe, expect, it } from 'vitest';

import { countTotal, flattenIcd10 } from './flatten';
import type { Icd10ListRow } from './types';

/**
 * Разворачивание классификации в список строк.
 *
 * Проверяется прежде всего то, что легко нарушить незаметно: подрубрика обязана идти следом за
 * своей рубрикой, а найденный код — показываться вместе с рубрикой, к которой относится. Код без
 * места в классификации читается как самостоятельный диагноз, а он им не является.
 */

const rubric = (
  code: string,
  name: string,
  chapter: string,
  children: { code: string; name: string; hasNote?: boolean }[] = [],
  hasNote = false,
): Icd10ListRow => ({
  code,
  name,
  chapter,
  blockRange: 'I20–I25',
  blockName: 'Ишемическая болезнь сердца',
  hasNote,
  children: children.map((child) => ({ code: child.code, name: child.name, hasNote: child.hasNote ?? hasNote })),
});

const ROWS: Icd10ListRow[] = [
  rubric(
    'I21',
    'Острый инфаркт миокарда',
    'IX',
    [
      { code: 'I21.0', name: 'Острый трансмуральный инфаркт передней стенки миокарда' },
      { code: 'I21.4', name: 'Острый субэндокардиальный инфаркт миокарда' },
    ],
    true,
  ),
  rubric('I22', 'Повторный инфаркт миокарда', 'IX', [{ code: 'I22.0', name: 'Повторный инфаркт передней стенки' }], true),
  rubric('J20', 'Острый бронхит', 'X', [{ code: 'J20.9', name: 'Острый бронхит неуточнённый' }]),
  rubric('J40', 'Бронхит, не уточнённый как острый или хронический', 'X'),
];

const all = { query: '', chapter: null, onlyWithNote: false, showChildren: true };

describe('порядок строк', () => {
  it('подрубрика идёт сразу за своей рубрикой', () => {
    expect(flattenIcd10(ROWS, all).map((row) => row.code)).toEqual([
      'I21',
      'I21.0',
      'I21.4',
      'I22',
      'I22.0',
      'J20',
      'J20.9',
      'J40',
    ]);
  });

  it('глубина различает рубрику и подрубрику', () => {
    const rows = flattenIcd10(ROWS, all);
    expect(rows.find((row) => row.code === 'I21')?.depth).toBe(0);
    expect(rows.find((row) => row.code === 'I21.0')?.depth).toBe(1);
  });

  it('подрубрика наследует класс и блок своей рубрики', () => {
    const child = flattenIcd10(ROWS, all).find((row) => row.code === 'I21.0');
    expect(child?.chapter).toBe('IX');
    expect(child?.blockRange).toBe('I20–I25');
  });

  it('число подрубрик стоит у рубрики и обнуляется у подрубрики', () => {
    const rows = flattenIcd10(ROWS, all);
    expect(rows.find((row) => row.code === 'I21')?.children).toBe(2);
    expect(rows.find((row) => row.code === 'I21.0')?.children).toBe(0);
  });
});

describe('подрубрики можно свернуть', () => {
  it('остаётся оглавление из одних рубрик', () => {
    const rows = flattenIcd10(ROWS, { ...all, showChildren: false });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I22', 'J20', 'J40']);
  });

  it('счётчик подрубрик у рубрики при этом сохраняется', () => {
    const rows = flattenIcd10(ROWS, { ...all, showChildren: false });
    expect(rows[0]?.children).toBe(2);
  });
});

describe('поиск', () => {
  it('совпадение в рубрике показывает все её подрубрики — из них и выбирают', () => {
    const rows = flattenIcd10(ROWS, { ...all, query: 'острый инфаркт' });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I21.0', 'I21.4']);
  });

  it('совпадение в подрубрике показывает и её рубрику', () => {
    // Иначе «I21.4 Острый субэндокардиальный инфаркт» стоит без строки о том, что это инфаркт
    // миокарда, — то есть код без места в классификации.
    const rows = flattenIcd10(ROWS, { ...all, query: 'субэндокардиальный' });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I21.4']);
  });

  it('ищет и по коду, в том числе по коду подрубрики', () => {
    expect(flattenIcd10(ROWS, { ...all, query: 'i21.4' }).map((row) => row.code)).toEqual(['I21', 'I21.4']);
  });

  it('со свёрнутыми подрубриками находит только рубрики', () => {
    const rows = flattenIcd10(ROWS, { ...all, query: 'субэндокардиальный', showChildren: false });
    expect(rows).toHaveLength(0);
  });

  it('ничего не нашлось — пустой список, а не весь справочник', () => {
    expect(flattenIcd10(ROWS, { ...all, query: 'такого нет' })).toHaveLength(0);
  });
});

describe('фильтры', () => {
  it('класс отбирает рубрики вместе с их подрубриками', () => {
    expect(flattenIcd10(ROWS, { ...all, chapter: 'X' }).map((row) => row.code)).toEqual(['J20', 'J20.9', 'J40']);
  });

  it('«только со справкой» оставляет и рубрику, и унаследовавшие справку подрубрики', () => {
    expect(flattenIcd10(ROWS, { ...all, onlyWithNote: true }).map((row) => row.code)).toEqual([
      'I21',
      'I21.0',
      'I21.4',
      'I22',
      'I22.0',
    ]);
  });

  it('рубрика без справки остаётся, если справка есть у её подрубрики', () => {
    const rows = [rubric('R00', 'Отклонения ритма', 'XVIII', [{ code: 'R00.0', name: 'Тахикардия', hasNote: true }])];
    expect(flattenIcd10(rows, { ...all, onlyWithNote: true }).map((row) => row.code)).toEqual(['R00', 'R00.0']);
  });

  it('фильтры складываются', () => {
    const rows = flattenIcd10(ROWS, { ...all, chapter: 'IX', query: 'повторный' });
    expect(rows.map((row) => row.code)).toEqual(['I22', 'I22.0']);
  });
});

describe('счётчик', () => {
  it('считает рубрики и подрубрики вместе', () => {
    expect(countTotal(ROWS)).toBe(8);
  });
});
