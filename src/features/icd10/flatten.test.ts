import { describe, expect, it } from 'vitest';

import { countTotal, flattenIcd10 } from './flatten';
import type { Icd10ChildrenMap, Icd10ListRow } from './types';

/**
 * Разворачивание классификации в список строк.
 *
 * Проверяется прежде всего то, что легко нарушить незаметно: подрубрика обязана идти следом за
 * своей рубрикой, найденный код — показываться вместе с рубрикой, к которой относится, а отбор —
 * раскрывать рубрику сам. Спрятанное за нераскрытой рубрикой совпадение читается как «ничего не
 * найдено», то есть как неверный ответ.
 */

const rubric = (
  code: string,
  name: string,
  chapter: string,
  childCount: number,
  hasNote = false,
): Icd10ListRow => ({
  code,
  name,
  chapter,
  blockRange: 'I20–I25',
  blockName: 'Ишемическая болезнь сердца',
  hasNote,
  childCount,
});

const ROWS: Icd10ListRow[] = [
  rubric('I21', 'Острый инфаркт миокарда', 'IX', 2, true),
  rubric('I22', 'Повторный инфаркт миокарда', 'IX', 1, true),
  rubric('J20', 'Острый бронхит', 'X', 1),
  rubric('J40', 'Бронхит, не уточнённый как острый или хронический', 'X', 0),
];

const CHILDREN: Icd10ChildrenMap = {
  I21: [
    { code: 'I21.0', name: 'Острый трансмуральный инфаркт передней стенки миокарда', hasNote: true },
    { code: 'I21.4', name: 'Острый субэндокардиальный инфаркт миокарда', hasNote: true },
  ],
  I22: [{ code: 'I22.0', name: 'Повторный инфаркт передней стенки', hasNote: true }],
  J20: [{ code: 'J20.9', name: 'Острый бронхит неуточнённый', hasNote: false }],
};

const base = { query: '', chapter: null, onlyWithNote: false, expanded: new Set<string>() };

describe('нераскрытый список', () => {
  it('состоит из одних рубрик, даже когда подрубрики уже загружены', () => {
    expect(flattenIcd10(ROWS, CHILDREN, base).map((row) => row.code)).toEqual(['I21', 'I22', 'J20', 'J40']);
  });

  it('число подрубрик у рубрики известно и без них самих', () => {
    const rows = flattenIcd10(ROWS, null, base);
    expect(rows[0]?.children).toBe(2);
    expect(rows[3]?.children).toBe(0);
  });

  it('ни одна рубрика не помечена раскрытой', () => {
    expect(flattenIcd10(ROWS, CHILDREN, base).every((row) => !row.expanded)).toBe(true);
  });
});

describe('раскрытие руками', () => {
  it('подрубрика идёт сразу за своей рубрикой', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, expanded: new Set(['I21']) });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I21.0', 'I21.4', 'I22', 'J20', 'J40']);
  });

  it('раскрытая рубрика помечена, соседние — нет', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, expanded: new Set(['I21']) });
    expect(rows.find((row) => row.code === 'I21')?.expanded).toBe(true);
    expect(rows.find((row) => row.code === 'I22')?.expanded).toBe(false);
  });

  it('глубина различает рубрику и подрубрику', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, expanded: new Set(['I21']) });
    expect(rows.find((row) => row.code === 'I21')?.depth).toBe(0);
    expect(rows.find((row) => row.code === 'I21.0')?.depth).toBe(1);
  });

  it('подрубрика наследует класс и блок своей рубрики', () => {
    const child = flattenIcd10(ROWS, CHILDREN, { ...base, expanded: new Set(['I21']) }).find(
      (row) => row.code === 'I21.0',
    );
    expect(child?.chapter).toBe('IX');
    expect(child?.blockRange).toBe('I20–I25');
  });

  it('раскрыть все — это все рубрики разом', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, expanded: new Set(['I21', 'I22', 'J20', 'J40']) });
    expect(rows).toHaveLength(8);
  });

  it('пока подрубрики не приехали, раскрытая рубрика остаётся одна', () => {
    // Не пустой список и не заглушка: рубрика на месте, уточнений под ней пока нет, и страница
    // говорит об этом отдельной строкой.
    const rows = flattenIcd10(ROWS, null, { ...base, expanded: new Set(['I21']) });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I22', 'J20', 'J40']);
    expect(rows[0]?.expanded).toBe(false);
  });
});

describe('поиск раскрывает сам', () => {
  it('совпадение в рубрике показывает все её подрубрики — из них и выбирают', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, query: 'острый инфаркт' });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I21.0', 'I21.4']);
  });

  it('совпадение в подрубрике показывает и её рубрику', () => {
    // Иначе «I21.4 Острый субэндокардиальный инфаркт» стоит без строки о том, что это инфаркт
    // миокарда, — то есть код без места в классификации.
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, query: 'субэндокардиальный' });
    expect(rows.map((row) => row.code)).toEqual(['I21', 'I21.4']);
  });

  it('ищет и по коду, в том числе по коду подрубрики', () => {
    expect(flattenIcd10(ROWS, CHILDREN, { ...base, query: 'i21.4' }).map((row) => row.code)).toEqual([
      'I21',
      'I21.4',
    ]);
  });

  it('пока подрубрики не приехали, поиск находит только рубрики', () => {
    const rows = flattenIcd10(ROWS, null, { ...base, query: 'субэндокардиальный' });
    expect(rows).toHaveLength(0);
  });

  it('ничего не нашлось — пустой список, а не весь справочник', () => {
    expect(flattenIcd10(ROWS, CHILDREN, { ...base, query: 'такого нет' })).toHaveLength(0);
  });

  it('свёрнутость на поиск не влияет: спрятать найденное значило бы соврать', () => {
    const collapsed = flattenIcd10(ROWS, CHILDREN, { ...base, query: 'субэндокардиальный' });
    const expandedToo = flattenIcd10(ROWS, CHILDREN, {
      ...base,
      query: 'субэндокардиальный',
      expanded: new Set(['I22']),
    });
    expect(expandedToo.map((row) => row.code)).toEqual(collapsed.map((row) => row.code));
  });
});

describe('фильтры', () => {
  it('класс отбирает рубрики, не раскрывая их', () => {
    expect(flattenIcd10(ROWS, CHILDREN, { ...base, chapter: 'X' }).map((row) => row.code)).toEqual(['J20', 'J40']);
  });

  it('класс складывается с раскрытием', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, chapter: 'X', expanded: new Set(['J20']) });
    expect(rows.map((row) => row.code)).toEqual(['J20', 'J20.9', 'J40']);
  });

  it('«только со справкой» раскрывает рубрику сам', () => {
    expect(flattenIcd10(ROWS, CHILDREN, { ...base, onlyWithNote: true }).map((row) => row.code)).toEqual([
      'I21',
      'I21.0',
      'I21.4',
      'I22',
      'I22.0',
    ]);
  });

  it('рубрика без справки остаётся, если справка есть у её подрубрики', () => {
    const rows = [rubric('R00', 'Отклонения ритма', 'XVIII', 1)];
    const children: Icd10ChildrenMap = { R00: [{ code: 'R00.0', name: 'Тахикардия', hasNote: true }] };
    expect(flattenIcd10(rows, children, { ...base, onlyWithNote: true }).map((row) => row.code)).toEqual([
      'R00',
      'R00.0',
    ]);
  });

  it('фильтры складываются', () => {
    const rows = flattenIcd10(ROWS, CHILDREN, { ...base, chapter: 'IX', query: 'повторный' });
    expect(rows.map((row) => row.code)).toEqual(['I22', 'I22.0']);
  });
});

describe('счётчик', () => {
  it('считает всю классификацию по числам рубрик, не дожидаясь подрубрик', () => {
    expect(countTotal(ROWS)).toBe(8);
  });
});
