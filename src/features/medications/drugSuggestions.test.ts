import { describe, expect, it } from 'vitest';

import type { DrugSummary } from '../drugs/types';
import { drugOptions } from './drugSuggestions';

const drug = (inn: string, brandNames: string[]): DrugSummary => ({
  id: inn,
  inn,
  brandNames,
  category: '',
  pharmGroup: '',
  atcCode: '',
  createdAt: '',
  updatedAt: '',
});

describe('подсказка названий препарата', () => {
  // Mantine вставляет в поле подпись варианта, а не отдельное значение: МНН обязано ехать рядом
  // с вариантом, а не внутри того, что попадёт в карту и в проверку.
  it('в поле попадает только само название', () => {
    for (const option of drugOptions([drug('Бисопролол', ['Конкор'])], 'конк')) {
      expect(option.value).not.toContain('·');
    }
  });

  // Правила взаимодействий написаны на МНН, и записанное торговое разрешается только пока стоит
  // в формуляре: МНН, выбранное из подсказки, разрешается всегда.
  it('предлагает МНН рядом с торговым названием', () => {
    const options = drugOptions([drug('Бисопролол', ['Конкор', 'Бидоп'])], 'конк');
    expect(options).toEqual([
      { value: 'Конкор', inn: 'Бисопролол' },
      { value: 'Бисопролол' },
    ]);
  });

  it('совпавшее с начала слова идёт первым', () => {
    const options = drugOptions([drug('Ацетилсалициловая кислота', ['ТромбоАСС', 'Кардиомагнил'])], 'кард');
    expect(options[0].value).toBe('Кардиомагнил');
  });

  // Сервер ищет шире, чем по одному имени, — препарат мог найтись и не по названию.
  it('препарат без совпадения по имени предлагается своим МНН', () => {
    const options = drugOptions([drug('Метформин', ['Глюкофаж'])], 'бигуанид');
    expect(options).toEqual([{ value: 'Метформин' }]);
  });

  it('одно торговое название у двух МНН не задваивается', () => {
    const options = drugOptions([drug('Этинилэстрадиол', ['Логест']), drug('Этинилэстрадиол/гестоден', ['Логест'])], 'логест');
    expect(options.filter((o) => o.value === 'Логест')).toHaveLength(1);
  });

  it('список не разрастается сверх потолка', () => {
    const many = Array.from({ length: 20 }, (_, i) => drug(`Препарат ${i}`, [`Бренд ${i}`]));
    expect(drugOptions(many, 'пре', 8)).toHaveLength(8);
  });
});
