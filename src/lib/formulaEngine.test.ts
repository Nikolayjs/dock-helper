import { describe, expect, it } from 'vitest';

import {
  FORMULA_CONSTANT_NAMES,
  FORMULA_FUNCTION_ARITY,
  FORMULA_FUNCTION_DOCS,
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
    // Арность берётся у самого движка, а не из списка рядом: список разошёлся бы с ним при первой
    // же новой функции — ровно так `round` и оказался объявлен «одноаргументным» на словах.
    for (const name of FORMULA_FUNCTION_NAMES) {
      const args = Array.from({ length: FORMULA_FUNCTION_ARITY[name].min }, () => '2').join(', ');
      expect(Number.isFinite(calc(name + '(' + args + ')'))).toBe(true);
    }
  });

  /*
   * Справка конструктора берёт список функций отсюда же. Проверяется не только полнота, но и то,
   * что **каждый пример действительно считается**: справка, обещающая формулу, которая не работает,
   * хуже отсутствия справки — по ней врач и напишет.
   */
  it('у каждой функции есть описание и рабочий пример', () => {
    expect(FORMULA_FUNCTION_DOCS.map((doc) => doc.name).sort()).toEqual([...FORMULA_FUNCTION_NAMES].sort());

    for (const doc of FORMULA_FUNCTION_DOCS) {
      expect({ name: doc.name, summary: doc.summary.length > 0 }).toEqual({ name: doc.name, summary: true });
      // В примерах стоят имена полей вымышленного калькулятора — подставляем им числа.
      const variables = Object.fromEntries(getFormulaVariables(doc.example).map((name) => [name, 2]));
      expect({ name: doc.name, finite: Number.isFinite(evaluateFormula(doc.example, variables)) }).toEqual({
        name: doc.name,
        finite: true,
      });
    }
  });

  it('подпись функции показывает необязательные аргументы, а не просто имя', () => {
    const round = FORMULA_FUNCTION_DOCS.find((doc) => doc.name === 'round');
    expect(round?.signature).toBe('round(x; [x])');
    const min = FORMULA_FUNCTION_DOCS.find((doc) => doc.name === 'min');
    expect(min?.signature).toBe('min(…)');
  });

  it('лишний аргумент — ошибка, а не молча отброшенное', () => {
    // `round(x, 1)` считался как `round(x)`: целый ИМТ там, где врач просил десятые.
    expect(() => calc('sqrt(4, 2)')).toThrow(/принимает один аргумент/);
    expect(() => calc('if(1, 2)')).toThrow(/принимает три аргумента/);
    expect(() => calc('round(1.234, 1, 5)')).toThrow(/от 1 до 2 аргументов/);
    expect(() => calc('min()')).toThrow(/не менее одного аргумента/);
  });

  it('round принимает знаки после запятой — как ОКРУГЛ в таблицах документа', () => {
    expect(calc('round(2.567, 1)')).toBe(2.6);
    expect(calc('round(2.567)')).toBe(3);
    expect(calc('round(70 / 3, 2)')).toBe(23.33);
    // Через степень десяти `round(1.005, 2)` дало бы 1: двоичная дробь чуть меньше 100,5.
    expect(calc('round(1.005, 2)')).toBe(1.01);
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

describe('сравнения', () => {
  it('дают единицу и ноль, а не «да» и «нет»', () => {
    expect(calc('3 > 2')).toBe(1);
    expect(calc('3 < 2')).toBe(0);
  });

  it('шесть знаков, записанных как в Excel', () => {
    expect(calc('2 <= 2')).toBe(1);
    expect(calc('2 >= 3')).toBe(0);
    expect(calc('2 = 2')).toBe(1);
    expect(calc('2 <> 2')).toBe(0);
    expect(calc('2 <> 3')).toBe(1);
  });

  it('стоят ниже сложения: a + 1 > b — это (a + 1) > b', () => {
    expect(calc('1 + 1 > 1')).toBe(1);
    expect(calc('2 * 3 = 6')).toBe(1);
  });

  it('два сравнения подряд — ошибка, а не тихо неверный ответ', () => {
    // «1 < x < 5» слева направо посчиталось бы как «(1 < x) < 5», то есть всегда истина.
    expect(() => calc('1 < 2 < 5')).toThrow(FormulaError);
  });

  it('«<» без правой части — ошибка', () => {
    expect(() => calc('1 <')).toThrow(FormulaError);
  });
});

describe('условие и логика', () => {
  it('if выбирает ветвь по условию', () => {
    expect(calc('if(1, 10, 20)')).toBe(10);
    expect(calc('if(0, 10, 20)')).toBe(20);
  });

  it('условием служит сравнение', () => {
    expect(calc('if(пол = 1, 1.23 * x, x)', { пол: 1, x: 100 })).toBeCloseTo(123, 6);
    expect(calc('if(пол = 1, 1.23 * x, x)', { пол: 2, x: 100 })).toBe(100);
  });

  it('невыбранная ветвь считается тоже, но её значение отбрасывается', () => {
    // Деление на ноль здесь даёт бесконечность, а не падение, поэтому ленивость не нужна.
    expect(calc('if(x = 0, 0, 100 / x)', { x: 0 })).toBe(0);
  });

  it('and, or, not', () => {
    expect(calc('and(1, 1)')).toBe(1);
    expect(calc('and(1, 0)')).toBe(0);
    expect(calc('or(0, 1)')).toBe(1);
    expect(calc('or(0, 0)')).toBe(0);
    expect(calc('not(0)')).toBe(1);
    expect(calc('not(5)')).toBe(0);
  });

  it('and и or принимают сколько угодно условий', () => {
    expect(calc('and(1, 1, 1, 0)')).toBe(0);
    expect(calc('or(0, 0, 0, 3)')).toBe(1);
  });

  it('условия вкладываются', () => {
    const formula = 'if(and(возраст > 60, пол = 1), 2, if(возраст > 60, 1, 0))';
    expect(calc(formula, { возраст: 70, пол: 1 })).toBe(2);
    expect(calc(formula, { возраст: 70, пол: 2 })).toBe(1);
    expect(calc(formula, { возраст: 30, пол: 1 })).toBe(0);
  });

  it('переменные внутри условия попадают в список полей калькулятора', () => {
    expect(getFormulaVariables('if(пол = 1, вес * 1.23, вес)').sort()).toEqual(['вес', 'пол']);
  });
});

describe('точка с запятой как разделитель аргументов', () => {
  it('принимается наравне с запятой — так пишет русский Excel', () => {
    expect(calc('min(3; 1; 2)')).toBe(1);
    expect(calc('if(1; 10; 20)')).toBe(10);
  });

  it('десятичный разделитель при этом только точка', () => {
    // Иначе «min(1,5; 2)» нельзя разобрать однозначно: это либо два аргумента, либо три.
    expect(calc('min(1,5; 2)')).toBe(1);
    expect(calc('min(1.5; 2)')).toBe(1.5);
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

  it('Кокрофт-Голт с поправкой на пол — то, ради чего заводились условия', () => {
    // До появления `if` пол приходилось городить select-полем с числовым множителем.
    const formula = '(140 - возраст) * вес / (72 * креатинин) * if(пол = 2, 0.85, 1)';
    expect(calc(formula, { возраст: 60, вес: 80, креатинин: 1.1, пол: 1 })).toBeCloseTo(80.8, 1);
    expect(calc(formula, { возраст: 60, вес: 80, креатинин: 1.1, пол: 2 })).toBeCloseTo(68.7, 1);
  });

  it('шкала с порогами', () => {
    const formula = 'if(скф >= 90, 1, if(скф >= 60, 2, if(скф >= 30, 3, if(скф >= 15, 4, 5))))';
    expect(calc(formula, { скф: 95 })).toBe(1);
    expect(calc(formula, { скф: 62 })).toBe(2);
    expect(calc(formula, { скф: 31 })).toBe(3);
    expect(calc(formula, { скф: 20 })).toBe(4);
    expect(calc(formula, { скф: 9 })).toBe(5);
  });
});
