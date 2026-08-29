import { describe, expect, it } from 'vitest';

import {
  FORMULA_CONSTANT_NAMES,
  FORMULA_FUNCTION_NAMES,
  FormulaError,
  evaluateFormula,
  getFormulaVariables,
} from './formulaEngine';

/**
 * Движок формул калькуляторов и производных лабораторных показателей.
 *
 * Ошибки здесь тихие: формула считает не то, а выглядит посчитанной. Поэтому проверяется не только
 * то, что движок умеет, но и то, **как именно** он понимает спорные места — приоритеты, сторону
 * степени, унарный минус перед ней и знак процента. Врач набирает формулу по памяти об Excel, и
 * расхождение с ним было бы ровно тем видом ошибки, которую никто не заметит.
 */

const calc = (formula: string, variables: Record<string, number> = {}) => evaluateFormula(formula, variables);

describe('арифметика и приоритеты', () => {
  it('складывает и вычитает слева направо', () => {
    expect(calc('10 - 3 - 2')).toBe(5);
  });

  it('умножение и деление важнее сложения', () => {
    expect(calc('2 + 3 * 4')).toBe(14);
    expect(calc('2 + 8 / 4')).toBe(4);
  });

  it('скобки перебивают приоритет', () => {
    expect(calc('(2 + 3) * 4')).toBe(20);
  });

  it('степень правоассоциативна: 2^3^2 — это 2^(3^2), а не (2^3)^2', () => {
    expect(calc('2^3^2')).toBe(512);
  });

  it('степень важнее умножения', () => {
    expect(calc('2 * 3^2')).toBe(18);
  });

  it('унарный минус связывает крепче степени — как в Excel', () => {
    // −2^2 здесь равно 4, а не −4. Это расходится с математической записью и совпадает с Excel,
    // из которого врач и приносит привычку; тот же выбор сделан в табличном движке.
    expect(calc('-2^2')).toBe(4);
    expect(calc('0 - 2^2')).toBe(-4);
  });

  it('двойной минус — это плюс', () => {
    expect(calc('- -5')).toBe(5);
  });

  it('минус перед скобкой относится ко всей скобке', () => {
    expect(calc('-(3 + 4)')).toBe(-7);
  });

  it('дробные числа читаются с точкой', () => {
    expect(calc('0.5 * 3')).toBe(1.5);
  });

  it('пробелы не значат ничего', () => {
    expect(calc('  1   +   2  ')).toBe(3);
  });
});

describe('процент — это остаток от деления, а не сотая доля', () => {
  it('7 % 3 равно 1', () => {
    expect(calc('7 % 3')).toBe(1);
  });

  it('«70%» без второго числа формулой не является', () => {
    // Врач, набравший 70% в надежде получить 0,7, получит внятный отказ, а не тихую единицу.
    expect(() => calc('70%')).toThrow(FormulaError);
  });
});

describe('переменные', () => {
  it('подставляются по имени', () => {
    expect(calc('вес / (рост * рост)', { вес: 70, рост: 1.75 })).toBeCloseTo(22.857, 3);
  });

  it('имена бывают кириллическими, латинскими и с подчёркиванием', () => {
    expect(calc('вес_кг + weight2', { вес_кг: 1, weight2: 2 })).toBe(3);
  });

  it('неизвестная переменная — ошибка, а не ноль', () => {
    expect(() => calc('a + b', { a: 1 })).toThrow(FormulaError);
  });

  it('переменная перекрывает одноимённую константу', () => {
    expect(calc('e', { e: 5 })).toBe(5);
  });
});

describe('константы', () => {
  it('pi и e известны без объявления', () => {
    expect(calc('pi')).toBeCloseTo(Math.PI, 12);
    expect(calc('e')).toBeCloseTo(Math.E, 12);
  });

  it('обе объявлены наружу', () => {
    expect([...FORMULA_CONSTANT_NAMES].sort()).toEqual(['e', 'pi']);
  });
});

describe('функции', () => {
  it('sqrt, abs, sign', () => {
    expect(calc('sqrt(9)')).toBe(3);
    expect(calc('abs(0 - 4)')).toBe(4);
    expect(calc('sign(0 - 2)')).toBe(-1);
  });

  it('round, floor, ceil', () => {
    expect(calc('round(2.5)')).toBe(3);
    expect(calc('floor(2.9)')).toBe(2);
    expect(calc('ceil(2.1)')).toBe(3);
  });

  it('min и max принимают сколько угодно аргументов', () => {
    expect(calc('min(3, 1, 2)')).toBe(1);
    expect(calc('max(3, 1, 2)')).toBe(3);
  });

  it('pow равен степени', () => {
    expect(calc('pow(2, 10)')).toBe(1024);
  });

  it('log — десятичный, ln — натуральный', () => {
    // Эти двое путаются чаще всего: в расчёте СКФ и в шкалах используется именно десятичный.
    expect(calc('log(1000)')).toBeCloseTo(3, 12);
    expect(calc('ln(e)')).toBeCloseTo(1, 12);
  });

  it('exp обратен ln', () => {
    expect(calc('ln(exp(2))')).toBeCloseTo(2, 12);
  });

  it('вызовы вкладываются друг в друга', () => {
    expect(calc('round(sqrt(max(4, 9)) * 2)')).toBe(6);
  });

  it('все объявленные функции действительно считаются', () => {
    for (const name of FORMULA_FUNCTION_NAMES) {
      const call = name === 'pow' ? 'pow(2, 3)' : name + '(2)';
      expect(Number.isFinite(calc(call))).toBe(true);
    }
  });

  it('неизвестная функция — ошибка', () => {
    expect(() => calc('tg(1)')).toThrow(FormulaError);
  });
});

describe('деление на ноль', () => {
  it('даёт бесконечность, а не падение: решает вызывающий', () => {
    // `CalculatorForm` и производные показатели анализатора сами проверяют `Number.isFinite`
    // и показывают «нет данных» — иначе пустое поле веса выглядело бы как поломка калькулятора.
    expect(calc('1 / 0')).toBe(Infinity);
    expect(Number.isNaN(calc('0 / 0'))).toBe(true);
  });
});

describe('разбор ломается внятно', () => {
  it('пустая формула', () => {
    expect(() => calc('')).toThrow(FormulaError);
  });

  it('число с двумя точками', () => {
    expect(() => calc('1.2.3')).toThrow(FormulaError);
  });

  it('посторонний символ', () => {
    expect(() => calc('2 & 3')).toThrow(FormulaError);
  });

  it('незакрытая скобка', () => {
    expect(() => calc('(1 + 2')).toThrow(FormulaError);
  });

  it('лишняя закрывающая скобка', () => {
    expect(() => calc('1 + 2)')).toThrow(FormulaError);
  });

  it('оборванная формула', () => {
    expect(() => calc('1 +')).toThrow(FormulaError);
  });

  it('до вычисления добраться нельзя — ошибка бросается на разборе', () => {
    expect(() => getFormulaVariables('1 +')).toThrow(FormulaError);
  });
});

describe('getFormulaVariables', () => {
  it('собирает имена без повторов', () => {
    expect(getFormulaVariables('a + b * a').sort()).toEqual(['a', 'b']);
  });

  it('заходит внутрь вызовов и вложенных вызовов', () => {
    expect(getFormulaVariables('round(min(вес, max(рост, 1)))').sort()).toEqual(['вес', 'рост']);
  });

  it('заходит под унарный минус', () => {
    expect(getFormulaVariables('-x')).toEqual(['x']);
  });

  it('константы переменными не считает — иначе конструктор просил бы ввести pi', () => {
    expect(getFormulaVariables('pi * r^2')).toEqual(['r']);
  });

  it('у формулы без переменных список пуст', () => {
    expect(getFormulaVariables('2 + 2')).toEqual([]);
  });
});

describe('формулы, которые действительно считают', () => {
  it('индекс массы тела', () => {
    expect(calc('вес / (рост / 100)^2', { вес: 70, рост: 168 })).toBeCloseTo(24.8, 1);
  });

  it('Кокрофт-Голт для мужчины', () => {
    expect(calc('(140 - возраст) * вес / (72 * креатинин)', { возраст: 60, вес: 80, креатинин: 1.1 })).toBeCloseTo(
      80.8,
      1,
    );
  });

  it('площадь поверхности тела по Мостеллеру', () => {
    expect(calc('sqrt(рост * вес / 3600)', { рост: 170, вес: 70 })).toBeCloseTo(1.818, 3);
  });
});
