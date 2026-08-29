import { describe, expect, it } from 'vitest';

import { findHeader, mapRows, parseDateCell } from './mapColumns';
import type { Cell } from './readTable';

/**
 * Разбор чужого реестра пациентов.
 *
 * Главное здесь — двузначный год. Прежнее правило «больше тридцати — значит девятнадцатый век»
 * давало пациенту 1930 года рождения дату **2030**, а 1929-му — 2029; это ровно та когорта, из
 * которой состоит диспансерная группа, и дальше эта дата уходит в расчёт возраста и в выбор
 * референсных интервалов анализатора.
 */

const THIS_YEAR = new Date().getFullYear();

describe('двузначный год', () => {
  it('30 — это 1930, а не 2030', () => {
    expect(parseDateCell('15.03.30')).toBe('1930-03-15');
  });

  it('29 — это 1929, а не 2029', () => {
    expect(parseDateCell('01.01.29')).toBe('1929-01-01');
  });

  it('31 — это 1931, как и раньше', () => {
    expect(parseDateCell('01.01.31')).toBe('1931-01-01');
  });

  it('05 — это 2005', () => {
    expect(parseDateCell('20.07.05')).toBe('2005-07-20');
  });

  it('текущий год двумя цифрами остаётся текущим', () => {
    const yy = String(THIS_YEAR % 100).padStart(2, '0');
    expect(parseDateCell(`01.02.${yy}`)).toBe(`${THIS_YEAR}-02-01`);
  });

  it('следующий год двумя цифрами уезжает на век назад — в будущем родиться нельзя', () => {
    const yy = String((THIS_YEAR + 1) % 100).padStart(2, '0');
    expect(parseDateCell(`01.02.${yy}`)).toBe(`${THIS_YEAR + 1 - 100}-02-01`);
  });

  it('ни одна дата из двух цифр не оказывается в будущем', () => {
    for (let yy = 0; yy <= 99; yy++) {
      const iso = parseDateCell(`01.06.${String(yy).padStart(2, '0')}`);
      expect(iso).not.toBeNull();
      expect(Number(iso!.slice(0, 4))).toBeLessThanOrEqual(THIS_YEAR);
    }
  });

  it('дата постановки на учёт читается тем же правилом', () => {
    // Отдельного окна для «недавнего прошлого» больше нет: и рождение, и постановка на учёт —
    // события прошлого, и одно правило описывает оба.
    const header = findHeader([['ФИО', 'Дата рождения', 'Дата постановки на учёт']])!;
    const { patients } = mapRows(
      [
        ['ФИО', 'Дата рождения', 'Дата постановки на учёт'],
        ['Иванов Иван Иванович', '15.03.30', '10.09.24'],
      ],
      header,
    );
    expect(patients[0].birthDate).toBe('1930-03-15');
    expect(patients[0].registeredDate).toBe('2024-09-10');
  });
});

describe('форматы даты', () => {
  it('дд.мм.гггг', () => {
    expect(parseDateCell('07.11.1958')).toBe('1958-11-07');
  });

  it('дд-мм-гггг и дд/мм/гггг', () => {
    expect(parseDateCell('07-11-1958')).toBe('1958-11-07');
    expect(parseDateCell('7/11/1958')).toBe('1958-11-07');
  });

  it('гггг-мм-дд', () => {
    expect(parseDateCell('1958-11-07')).toBe('1958-11-07');
  });

  it('однозначные день и месяц', () => {
    expect(parseDateCell('7.1.1958')).toBe('1958-01-07');
  });

  it('Date из читалки берётся по UTC, а не по местному времени', () => {
    // Иначе у всех западнее Гринвича день рождения уезжал бы на сутки назад.
    expect(parseDateCell(new Date(Date.UTC(1958, 10, 7)))).toBe('1958-11-07');
  });

  it('число — это серийная дата Excel', () => {
    // Отсчёт от 30.12.1899 — с учётом того самого несуществующего 29 февраля 1900 года.
    expect(parseDateCell(21496)).toBe('1958-11-07');
  });
});

describe('мусор в колонке даты', () => {
  it('пустая ячейка — это отсутствие даты, а не сегодня', () => {
    expect(parseDateCell('')).toBeNull();
    expect(parseDateCell(null)).toBeNull();
    expect(parseDateCell(undefined as unknown as Cell)).toBeNull();
  });

  it('текст датой не становится', () => {
    expect(parseDateCell('не указана')).toBeNull();
    expect(parseDateCell('—')).toBeNull();
  });

  it('несуществующий день отвергается, а не переезжает на март', () => {
    expect(parseDateCell('31.02.1980')).toBeNull();
  });

  it('тринадцатый месяц отвергается', () => {
    expect(parseDateCell('01.13.1980')).toBeNull();
  });

  it('год до 1900 отвергается', () => {
    expect(parseDateCell('01.01.1899')).toBeNull();
  });
});

describe('заголовок реестра', () => {
  it('находится не в первой строке', () => {
    const rows: Cell[][] = [
      ['Реестр диспансерных больных за 2025 год'],
      [],
      ['ФИО', 'Пол', 'Дата рождения', 'Телефон'],
      ['Иванов Иван Иванович', 'м', '15.03.30', '+79001234567'],
    ];
    const header = findHeader(rows)!;
    expect(header.rowIndex).toBe(2);
    expect(header.columns.fullName).toBe(0);
    expect(header.columns.birthDate).toBe(2);
  });

  it('«Фамилия имя отчество» — одна колонка, а не фамилия', () => {
    const header = findHeader([['Фамилия имя отчество', 'Дата рождения']])!;
    expect(header.columns.fullName).toBe(0);
    expect(header.columns.lastName).toBeUndefined();
  });

  it('без колонки с именем заголовка нет', () => {
    expect(findHeader([['Дата рождения', 'Телефон']])).toBeNull();
  });
});

describe('строки реестра', () => {
  const rows: Cell[][] = [
    ['ФИО', 'Пол', 'Дата рождения', 'Телефон'],
    ['Иванов Иван Иванович', 'м', '15.03.30', '+7 900 123-45-67'],
    ['Петрова Мария Сергеевна', 'жен.', '20.07.05', ''],
    ['Итого:', '', '', '5 человек'],
    ['', '', '', ''],
  ];
  const header = findHeader(rows)!;
  const mapped = mapRows(rows, header);

  it('итоговая строка пациентом не становится', () => {
    expect(mapped.patients.map((p) => p.fullName)).toEqual(['Иванов Иван Иванович', 'Петрова Мария Сергеевна']);
  });

  it('пол читается в любом написании', () => {
    expect(mapped.patients[0].sex).toBe('male');
    expect(mapped.patients[1].sex).toBe('female');
  });

  it('дата рождения тридцатого года не уезжает в будущее', () => {
    expect(mapped.patients[0].birthDate).toBe('1930-03-15');
    expect(mapped.patients[1].birthDate).toBe('2005-07-20');
  });

  it('номер строки в файле сохраняется, чтобы отвергнутую можно было найти', () => {
    expect(mapped.patients[0].sourceRow).toBe(2);
  });
});
