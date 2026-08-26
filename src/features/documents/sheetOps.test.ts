import { describe, expect, it } from 'vitest';

import {
  addColumn,
  addRow,
  isSheetEmpty,
  parseClipboardGrid,
  pasteInto,
  removeColumn,
  removeRow,
  setCell,
  setColumnName,
  trimTrailingRows,
} from './sheetOps';
import type { DocumentSheet } from './types';

const sheet = (): DocumentSheet => ({
  columns: ['Пациент', 'Экспертиза'],
  rows: [
    ['Иванов', 'МСЭ'],
    ['Петрова', 'ВК'],
  ],
});

describe('правки ячеек', () => {
  it('меняет одну ячейку', () => {
    expect(setCell(sheet(), 1, 0, 'Сидоров').rows[1]).toEqual(['Сидоров', 'ВК']);
  });

  it('не пересоздаёт нетронутые строки', () => {
    // Редактор мемоизирует строку по ссылке: без этого каждое нажатие клавиши перерисовывало бы
    // весь реестр, а не одну строку.
    const before = sheet();
    const after = setCell(before, 0, 0, 'Кузнецов');
    expect(after.rows[1]).toBe(before.rows[1]);
    expect(after.rows[0]).not.toBe(before.rows[0]);
  });

  it('переименовывает столбец', () => {
    expect(setColumnName(sheet(), 1, 'Вид').columns).toEqual(['Пациент', 'Вид']);
  });
});

describe('строки и столбцы', () => {
  it('добавляет строку по ширине таблицы', () => {
    expect(addRow(sheet()).rows[2]).toEqual(['', '']);
  });

  it('удаляет строку', () => {
    expect(removeRow(sheet(), 0).rows).toEqual([['Петрова', 'ВК']]);
  });

  it('вставляет столбец справа от указанного и раздвигает все строки', () => {
    const next = addColumn(sheet(), 0);
    expect(next.columns).toEqual(['Пациент', 'Столбец 3', 'Экспертиза']);
    expect(next.rows[0]).toEqual(['Иванов', '', 'МСЭ']);
  });

  it('добавляет столбец в конец, если место не указано', () => {
    expect(addColumn(sheet()).columns).toEqual(['Пациент', 'Экспертиза', 'Столбец 3']);
  });

  it('удаляет столбец вместе с его ячейками', () => {
    const next = removeColumn(sheet(), 0);
    expect(next.columns).toEqual(['Экспертиза']);
    expect(next.rows).toEqual([['МСЭ'], ['ВК']]);
  });

  it('не даёт удалить последний столбец', () => {
    const one: DocumentSheet = { columns: ['Один'], rows: [['а']] };
    expect(removeColumn(one, 0)).toEqual(one);
  });
});

describe('разбор буфера обмена', () => {
  it('делит по табуляции и переводам строки', () => {
    expect(parseClipboardGrid('а\tб\nв\tг')).toEqual([
      ['а', 'б'],
      ['в', 'г'],
    ]);
  });

  it('понимает ячейку в кавычках с табуляцией и переводом строки внутри', () => {
    expect(parseClipboardGrid('"строка 1\nстрока 2"\tб')).toEqual([['строка 1\nстрока 2', 'б']]);
    expect(parseClipboardGrid('"с\tтабом"\tб')).toEqual([['с\tтабом', 'б']]);
  });

  it('разворачивает удвоенную кавычку', () => {
    expect(parseClipboardGrid('"он сказал ""да"""')).toEqual([['он сказал "да"']]);
  });

  it('не добавляет пустую строку из-за хвостового перевода строки', () => {
    expect(parseClipboardGrid('а\tб\n')).toEqual([['а', 'б']]);
  });

  it('одна ячейка остаётся одной ячейкой', () => {
    expect(parseClipboardGrid('просто текст')).toEqual([['просто текст']]);
  });
});

describe('вставка в таблицу', () => {
  it('кладёт кусок начиная с указанной ячейки', () => {
    const next = pasteInto(sheet(), 0, 0, [['Кузнецов', 'ВТЭК']]);
    expect(next.rows[0]).toEqual(['Кузнецов', 'ВТЭК']);
    expect(next.rows[1]).toEqual(['Петрова', 'ВК']);
  });

  it('раздвигает таблицу вниз, а не обрезает вставку', () => {
    const next = pasteInto(sheet(), 1, 0, [
      ['а', 'б'],
      ['в', 'г'],
      ['д', 'е'],
    ]);
    expect(next.rows).toHaveLength(4);
    expect(next.rows[3]).toEqual(['д', 'е']);
  });

  it('раздвигает таблицу вправо и называет новые столбцы', () => {
    const next = pasteInto(sheet(), 0, 1, [['МСЭ', '12.09', 'выдано']]);
    expect(next.columns).toEqual(['Пациент', 'Экспертиза', 'Столбец 3', 'Столбец 4']);
    expect(next.rows[0]).toEqual(['Иванов', 'МСЭ', '12.09', 'выдано']);
    // Строка, которую вставка не задела, дополняется пустыми ячейками, а не остаётся короче.
    expect(next.rows[1]).toEqual(['Петрова', 'ВК', '', '']);
  });
});

describe('перед сохранением', () => {
  it('срезает пустые строки с конца', () => {
    const padded: DocumentSheet = { columns: ['А'], rows: [['раз'], [''], ['  ']] };
    expect(trimTrailingRows(padded).rows).toEqual([['раз']]);
  });

  it('оставляет пустую строку в середине — она может быть разделителем', () => {
    const spaced: DocumentSheet = { columns: ['А'], rows: [['раз'], [''], ['два']] };
    expect(trimTrailingRows(spaced).rows).toEqual([['раз'], [''], ['два']]);
  });

  it('пустой считает таблицу без единого значения', () => {
    expect(isSheetEmpty({ columns: ['А', 'Б'], rows: [['', ''], ['  ', '']] })).toBe(true);
    expect(isSheetEmpty({ columns: ['А'], rows: [['раз']] })).toBe(false);
    expect(isSheetEmpty(null)).toBe(true);
  });
});
