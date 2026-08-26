import { describe, expect, it } from 'vitest';

import { parseLabValues } from './parseLabValues';

/** The single analyte a one-line file yields. */
function one(line: string) {
  const [analyte, ...rest] = parseLabValues([line]);
  expect(rest).toEqual([]);
  return analyte;
}

describe('parseLabValues', () => {
  it('takes the result, not the reference bound that follows it', () => {
    expect(one('Гемоглобин 145 г/л 130 - 160')).toMatchObject({ name: 'Гемоглобин', value: 145, unit: 'г/л' });
  });

  it('reads through the mark a laboratory prints beside an abnormal result', () => {
    // Without the trailing `*` the scan walks past the result and files the reference bound as
    // though the patient's ALT were 41.
    expect(one('АлАТ 51* Ед/л < 41')).toMatchObject({ value: 51, unit: 'Ед/л' });
  });

  it('skips the previous-result column to reach the unit', () => {
    expect(one('АсАТ 25 46* Ед/л < 37')).toMatchObject({ name: 'АсАТ', value: 25, unit: 'Ед/л' });
  });

  it('keeps a digit that belongs to the name', () => {
    expect(one('Витамин B12 350 пг/мл 191 - 663')).toMatchObject({ name: 'Витамин B12', value: 350 });
  });

  it('reads a negative result written as a word', () => {
    expect(one('Белок отриц')).toMatchObject({ name: 'Белок', value: 0 });
  });

  it('leaves a graded positive for the doctor rather than inventing a number', () => {
    expect(parseLabValues(['Белок ++'])).toEqual([]);
  });

  it('ignores page furniture', () => {
    expect(parseLabValues(['Пациент: 33', 'Дата взятия образца: 14.05.2025 12:22', 'Возраст: 33 года'])).toEqual([]);
  });

  it('ignores the tail of a wrapped sentence', () => {
    expect(parseLabValues(['желательный уровень <5.0 ммоль/л'])).toEqual([]);
  });

  it('drops a unit cut in half by a narrow column', () => {
    expect(one('Креатинин 88 мкмоль/').unit).toBeUndefined();
  });

  it('reads the American units Инвитро prints', () => {
    expect(one('Эритроциты 5.44 млн/мкл 4.3 - 5.7')).toMatchObject({ value: 5.44, unit: 'млн/мкл' });
    expect(one('Тромбоциты 317 тыс/мкл 150 - 400')).toMatchObject({ value: 317, unit: 'тыс/мкл' });
    expect(one('Гемоглобин 16.6 г/дл 13.2 - 17.3')).toMatchObject({ value: 16.6, unit: 'г/дл' });
  });

  it('strips the trailing punctuation of a name split across columns', () => {
    expect(one('Нейтрофилы, абс. 5.73* тыс/мкл 1.78 - 5.38')).toMatchObject({
      name: 'Нейтрофилы, абс',
      value: 5.73,
    });
  });
});
