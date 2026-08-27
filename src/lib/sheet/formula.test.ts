import { describe, expect, it } from 'vitest';

import { columnIndex, columnLetter, formatRef, parseRef, shiftFormula } from './cellRef';
import {
  ERRORS,
  evaluateGrid,
  formatNumber,
  formulaForExcel,
  FUNCTION_DOCS,
  isFormula,
  literalValue,
  SUPPORTED_ENGLISH,
} from './formula';

/** Лист: нулевая строка — заголовки, то есть строка 1 в адресах Excel. */
const sheet = (rows: string[][]) => evaluateGrid(rows);

/** Значение одной ячейки по адресу Excel: строка 1-based, столбец по букве. */
function at(grid: string[][], address: string): string {
  const ref = parseRef(address)!;
  return grid[ref.row - 1][ref.col];
}

describe('columnIndex / columnLetter', () => {
  it('переводят номер столбца в букву и обратно', () => {
    for (const index of [0, 1, 25, 26, 51, 52, 701, 702]) {
      expect(columnIndex(columnLetter(index))).toBe(index);
    }
    expect(columnIndex('a')).toBe(0);
    expect(columnIndex('AA')).toBe(26);
  });
});

describe('parseRef', () => {
  it('читает относительные и абсолютные адреса', () => {
    expect(parseRef('B3')).toEqual({ col: 1, row: 3, colAbsolute: false, rowAbsolute: false });
    expect(parseRef('$B$3')).toEqual({ col: 1, row: 3, colAbsolute: true, rowAbsolute: true });
    expect(parseRef('$B3')).toEqual({ col: 1, row: 3, colAbsolute: true, rowAbsolute: false });
  });

  it('не считает адресом то, что им не является', () => {
    expect(parseRef('СУММ')).toBeNull();
    expect(parseRef('B')).toBeNull();
    expect(parseRef('3')).toBeNull();
    expect(parseRef('B3:B4')).toBeNull();
  });

  it('собирает адрес обратно с теми же долларами', () => {
    expect(formatRef(parseRef('$C$12')!)).toBe('$C$12');
    expect(formatRef(parseRef('C12')!)).toBe('C12');
  });
});

describe('shiftFormula', () => {
  it('двигает относительные ссылки', () => {
    expect(shiftFormula('=B2*600', 3, 0)).toBe('=B5*600');
    expect(shiftFormula('=B2*C2', 1, 1)).toBe('=C3*D3');
  });

  it('не двигает абсолютные', () => {
    // Ради этого доллары и существуют: ставка в $B$1 не должна разъезжаться при сортировке.
    expect(shiftFormula('=B2*$B$1', 3, 0)).toBe('=B5*$B$1');
    expect(shiftFormula('=$B2+B$1', 2, 0)).toBe('=$B4+B$1');
  });

  it('не трогает имена функций', () => {
    expect(shiftFormula('=СУММ(C2:C3)', 1, 0)).toBe('=СУММ(C3:C4)');
    expect(shiftFormula('=SUM(C2:C3)', 1, 0)).toBe('=SUM(C3:C4)');
  });

  it('не трогает текст в кавычках', () => {
    expect(shiftFormula('=ЕСЛИ(B2>0;"смотри A1";"")', 1, 0)).toBe('=ЕСЛИ(B3>0;"смотри A1";"")');
  });

  it('уехавшая за край ссылка становится #REF!', () => {
    expect(shiftFormula('=B2', -5, 0)).toBe('=#REF!');
    expect(shiftFormula('=B2', 0, -5)).toBe('=#REF!');
  });

  it('нулевой сдвиг оставляет формулу как есть', () => {
    expect(shiftFormula('=B2*600', 0, 0)).toBe('=B2*600');
  });
});

describe('literalValue', () => {
  it('числом считает то же, что и выгрузка', () => {
    expect(literalValue('14')).toBe(14);
    expect(literalValue('3.5')).toBe(3.5);
    // Телефон и номер с ведущим нулём остаются текстом — иначе формула складывала бы телефоны.
    expect(literalValue('89123456789')).toBe('89123456789');
    expect(literalValue('007')).toBe('007');
    expect(literalValue('')).toBe('');
  });
});

describe('арифметика', () => {
  const grid = sheet([
    ['Дней', 'Цена', 'Сумма'],
    ['14', '600', '=A2*B2'],
    ['3', '600', '=A3*B3'],
    ['', '', '=СУММ(C2:C3)'],
  ]);

  it('считает произведение по ссылкам', () => {
    expect(at(grid, 'C2')).toBe('8400');
    expect(at(grid, 'C3')).toBe('1800');
  });

  it('складывает диапазон, включая ячейки-формулы', () => {
    expect(at(grid, 'C4')).toBe('10200');
  });

  it('оставляет обычные ячейки нетронутыми', () => {
    expect(at(grid, 'A2')).toBe('14');
    expect(at(grid, 'A1')).toBe('Дней');
  });
});

describe('функции', () => {
  const grid = sheet([
    ['A', 'B'],
    ['10', 'текст'],
    ['20', ''],
    ['30', '5'],
    [
      '=СРЗНАЧ(A2:A4)',
      '=СЧЁТ(A2:B4)',
    ],
    ['=МИН(A2:A4)', '=МАКС(A2:A4)'],
    ['=СЧЁТЗ(B2:B4)', '=ОКРУГЛ(A2/3;2)'],
    ['=ЕСЛИ(A2>15;"много";"мало")', '=ABS(A2-A4)'],
    ['=ПРОИЗВЕД(A2:A3)', '=ЦЕЛОЕ(A2/3)'],
  ]);

  it('СРЗНАЧ и СЧЁТ', () => {
    expect(at(grid, 'A5')).toBe('20');
    // СЧЁТ считает только числа: «текст» и пустая ячейка не в счёт.
    expect(at(grid, 'B5')).toBe('4');
  });

  it('МИН и МАКС', () => {
    expect(at(grid, 'A6')).toBe('10');
    expect(at(grid, 'B6')).toBe('30');
  });

  it('СЧЁТЗ считает непустые, ОКРУГЛ округляет', () => {
    expect(at(grid, 'A7')).toBe('2');
    expect(at(grid, 'B7')).toBe('3.33');
  });

  it('ЕСЛИ выбирает ветвь', () => {
    expect(at(grid, 'A8')).toBe('мало');
  });

  it('ABS, ПРОИЗВЕД и ЦЕЛОЕ', () => {
    expect(at(grid, 'B8')).toBe('20');
    expect(at(grid, 'A9')).toBe('200');
    expect(at(grid, 'B9')).toBe('3');
  });

  it('английские имена работают наравне с русскими', () => {
    const english = sheet([['A'], ['5'], ['=SUM(A2:A2)+MAX(A2:A2)']]);
    expect(at(english, 'A3')).toBe('10');
  });
});

describe('ошибки', () => {
  it('деление на ноль', () => {
    expect(at(sheet([['A'], ['0'], ['=1/A2']]), 'A3')).toBe(ERRORS.div0);
  });

  it('неизвестная функция', () => {
    expect(at(sheet([['A'], ['=ВПР(A1;A1;1)']]), 'A2')).toBe(ERRORS.name);
  });

  it('нечисловой текст в арифметике', () => {
    expect(at(sheet([['A'], ['слова'], ['=A2*2']]), 'A3')).toBe(ERRORS.value);
  });

  it('циклическая ссылка не вешает вычисление', () => {
    const grid = sheet([['A', 'B'], ['=B2', '=A2']]);
    expect(at(grid, 'A2')).toBe(ERRORS.cycle);
  });

  it('ссылка на саму себя тоже цикл', () => {
    expect(at(sheet([['A'], ['=A2+1']]), 'A2')).toBe(ERRORS.cycle);
  });

  it('незакрытая скобка не роняет таблицу', () => {
    expect(at(sheet([['A'], ['=СУММ(A1']]), 'A2')).toBe(ERRORS.value);
  });

  it('ошибка распространяется по цепочке', () => {
    const grid = sheet([['A'], ['=1/0'], ['=A2+1']]);
    expect(at(grid, 'A3')).toBe(ERRORS.div0);
  });
});

describe('evaluateGrid и ссылки на строки', () => {
  it('лист без формул возвращается той же ссылкой', () => {
    // Редактор мемоизирует строку по ссылке: иначе таблица перерисовывалась бы целиком.
    const rows = [['A'], ['1']];
    expect(evaluateGrid(rows)).toBe(rows);
  });

  it('строки без формул сохраняют свои ссылки', () => {
    const rows = [['A'], ['1'], ['=A2+1']];
    const result = evaluateGrid(rows);
    expect(result[1]).toBe(rows[1]);
    expect(result[2]).not.toBe(rows[2]);
  });
});

describe('formatNumber', () => {
  it('не показывает двоичный мусор', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(8400)).toBe('8400');
    expect(formatNumber(1 / 3)).toBe('0.333333333333333');
  });
});

describe('formulaForExcel', () => {
  it('переводит имена на английский и точку с запятой в запятую', () => {
    expect(formulaForExcel('=СУММ(C2:C3)')).toBe('SUM(C2:C3)');
    expect(formulaForExcel('=ЕСЛИ(A2>1;"да";"нет")')).toBe('IF(A2>1,"да","нет")');
  });

  it('оставляет английские имена как есть', () => {
    expect(formulaForExcel('=SUM(C2:C3)')).toBe('SUM(C2:C3)');
  });

  it('не трогает точку с запятой внутри текста', () => {
    expect(formulaForExcel('="раз; два"')).toBe('"раз; два"');
  });
});

describe('isFormula', () => {
  it('формулой считается ячейка, начинающаяся со знака равенства', () => {
    expect(isFormula('=A1')).toBe(true);
    expect(isFormula('  =A1')).toBe(true);
    expect(isFormula('A1')).toBe(false);
    expect(isFormula('')).toBe(false);
    expect(isFormula('1=2')).toBe(false);
  });
});

describe('справочник функций', () => {
  it('описывает ровно то, что понимает вычислитель', () => {
    // Справка, живущая отдельно от движка, рано или поздно начинает обещать функцию, которой нет.
    expect([...FUNCTION_DOCS.map((doc) => doc.english)].sort()).toEqual([...SUPPORTED_ENGLISH].sort());
  });

  it('каждый пример из справочника считается без ошибок', () => {
    const grid = [
      ['A', 'B', 'C', 'D'],
      ['1', '14', '10', ''],
      ['2', '21', '20', ''],
      ['3', '7', '30', ''],
    ];
    for (const doc of FUNCTION_DOCS) {
      // Пример кладётся в столбец D — за пределами диапазонов, на которые он ссылается: иначе
      // формула попала бы в собственную сумму и честно вернула бы #ЦИКЛ!.
      const result = evaluateGrid([...grid, ['', '', '', doc.example]]);
      const value = result[result.length - 1][3];
      expect(value.startsWith('#'), `${doc.name}: ${doc.example} → ${value}`).toBe(false);
    }
  });
});
