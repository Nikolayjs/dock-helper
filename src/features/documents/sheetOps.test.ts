import { describe, expect, it } from 'vitest';

import {
  addColumn,
  addRow,
  addTotalsRow,
  buildGrid,
  isSheetEmpty,
  parseClipboardGrid,
  pasteInto,
  removeColumn,
  removeRow,
  removeTotalsRow,
  sortRows,
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
    // Имя новому столбцу не придумывается: он назван буквой в шапке, той же, что в формулах.
    expect(next.columns).toEqual(['Пациент', '', 'Экспертиза']);
    expect(next.rows[0]).toEqual(['Иванов', '', 'МСЭ']);
  });

  it('добавляет столбец в конец, если место не указано', () => {
    expect(addColumn(sheet()).columns).toEqual(['Пациент', 'Экспертиза', '']);
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

  it('раздвигает таблицу вправо, не выдумывая названий', () => {
    const next = pasteInto(sheet(), 0, 1, [['МСЭ', '12.09', 'выдано']]);
    expect(next.columns).toEqual(['Пациент', 'Экспертиза', '', '']);
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

// ─── Формулы, итоги и сортировка ─────────────────────────────────────────────

const register = (): DocumentSheet => ({
  columns: ['Пациент', 'Дней', 'Сумма'],
  rows: [
    ['Иванов', '14', '=B2*600'],
    ['Петрова', '3', '=B3*600'],
    ['Абрамов', '7', '=B4*600'],
  ],
});

describe('строка итогов', () => {
  it('суммирует только числовые столбцы и подписывает первый прочий', () => {
    const totals = addTotalsRow(register()).totals!;
    expect(totals).toEqual(['Итого', '=СУММ(B2:B4)', '=СУММ(C2:C4)']);
  });

  it('второй раз не заводится', () => {
    const once = addTotalsRow(register());
    expect(addTotalsRow(once)).toBe(once);
  });

  it('удаляется', () => {
    expect(removeTotalsRow(addTotalsRow(register())).totals).toBeNull();
  });

  it('дотягивается до новой последней строки', () => {
    // Иначе добавленная строка молча не попала бы в сумму — неверное число, которое ничем себя
    // не выдаёт.
    const grown = addRow(addTotalsRow(register()));
    expect(grown.totals![1]).toBe('=СУММ(B2:B5)');
  });

  it('подтягивается и при удалении строки', () => {
    const shrunk = removeRow(addTotalsRow(register()), 0);
    expect(shrunk.totals![1]).toBe('=СУММ(B2:B3)');
  });

  it('не трогает диапазон, который врач сузил намеренно', () => {
    const narrowed: DocumentSheet = { ...register(), totals: ['', '=СУММ(B2:B3)', ''] };
    expect(addRow(narrowed).totals![1]).toBe('=СУММ(B2:B3)');
  });

  it('едет вместе со столбцами', () => {
    const withColumn = addColumn(addTotalsRow(register()), 0);
    expect(withColumn.totals).toHaveLength(4);
    expect(withColumn.totals![1]).toBe('');
    expect(removeColumn(withColumn, 0).totals).toHaveLength(3);
  });
});

describe('сортировка', () => {
  it('по числовому столбцу — по величине', () => {
    const sorted = sortRows(register(), 1, 'asc');
    expect(sorted.rows.map((row) => row[0])).toEqual(['Петрова', 'Абрамов', 'Иванов']);
  });

  it('по убыванию', () => {
    expect(sortRows(register(), 1, 'desc').rows.map((row) => row[0])).toEqual(['Иванов', 'Абрамов', 'Петрова']);
  });

  it('по тексту — по алфавиту', () => {
    expect(sortRows(register(), 0, 'asc').rows.map((row) => row[0])).toEqual(['Абрамов', 'Иванов', 'Петрова']);
  });

  it('формулы уезжают вместе со своей строкой', () => {
    // Без сдвига формула считала бы по чужим данным и не сказала бы об этом.
    const sorted = sortRows(register(), 1, 'asc');
    expect(sorted.rows.map((row) => row[2])).toEqual(['=B2*600', '=B3*600', '=B4*600']);
    expect(sorted.rows[0]).toEqual(['Петрова', '3', '=B2*600']);
  });

  it('сортирует по вычисленному значению, а не по тексту формулы', () => {
    // Посимвольно все три ячейки столбца «Сумма» разные, но осмысленный порядок — по результату.
    const sorted = sortRows(register(), 2, 'desc');
    expect(sorted.rows.map((row) => row[1])).toEqual(['14', '7', '3']);
  });

  it('абсолютные ссылки при сортировке не двигаются', () => {
    const withRate: DocumentSheet = {
      columns: ['Пациент', 'Дней', 'Сумма'],
      rows: [
        ['Иванов', '14', '=B2*$B$1'],
        ['Петрова', '3', '=B3*$B$1'],
      ],
    };
    expect(sortRows(withRate, 1, 'asc').rows[0][2]).toBe('=B2*$B$1');
  });

  it('пустые ячейки всегда внизу', () => {
    const gaps: DocumentSheet = { columns: ['А'], rows: [[''], ['2'], ['1']] };
    expect(sortRows(gaps, 0, 'asc').rows).toEqual([['1'], ['2'], ['']]);
    expect(sortRows(gaps, 0, 'desc').rows).toEqual([['2'], ['1'], ['']]);
  });

  it('строка итогов не сортируется', () => {
    const sorted = sortRows(addTotalsRow(register()), 1, 'asc');
    expect(sorted.totals![1]).toBe('=СУММ(B2:B4)');
  });

  it('сохраняет порядок равных значений', () => {
    const ties: DocumentSheet = { columns: ['А', 'Б'], rows: [['1', 'первый'], ['1', 'второй']] };
    expect(sortRows(ties, 0, 'asc').rows.map((row) => row[1])).toEqual(['первый', 'второй']);
  });
});

describe('buildGrid', () => {
  it('складывает лист так же, как его нумерует Excel', () => {
    const grid = buildGrid(addTotalsRow(register()));
    expect(grid[0]).toEqual(['Пациент', 'Дней', 'Сумма']);
    expect(grid[1][0]).toBe('Иванов');
    expect(grid[4][0]).toBe('Итого');
  });
});
