// Minimal, dependency-free arithmetic expression engine used to evaluate
// calculator formulas. Deliberately supports only numbers, named variables,
// a fixed whitelist of math functions and +-*/%^ operators — there is no way
// to reach arbitrary JS, object properties or prototypes from a formula, so
// it is safe to evaluate formulas typed in by users.

export class FormulaError extends Error {}

type TokenType = 'num' | 'ident' | 'op' | 'lparen' | 'rparen' | 'comma';

interface Token {
  type: TokenType;
  value: string;
}

type AstNode =
  | { type: 'num'; value: number }
  | { type: 'var'; name: string }
  | { type: 'call'; name: string; args: AstNode[] }
  | { type: 'unary'; op: '-'; arg: AstNode }
  | { type: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^'; left: AstNode; right: AstNode }
  | { type: 'cmp'; op: CompareOp; left: AstNode; right: AstNode };

/** Сравнения записаны как в Excel: равенство — один знак «=», неравенство — «<>». */
type CompareOp = '<' | '<=' | '>' | '>=' | '=' | '<>';

const COMPARE_OPS: readonly CompareOp[] = ['<=', '>=', '<>', '<', '>', '='];

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: (v) => Math.round(v),
  floor: Math.floor,
  ceil: Math.ceil,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  pow: (base, exp) => Math.pow(base, exp),
  log: (v) => Math.log10(v),
  ln: Math.log,
  exp: Math.exp,
  sign: Math.sign,
  // Условие и логика. Ложь — это ноль, истина — единица, потому что движок умеет только числа;
  // сравнение возвращает то же самое, и `if(x > 5, 1, 0)` совпадает с `x > 5`.
  //
  // Ветви вычисляются обе, до выбора. Для арифметики это безразлично — `1/0` даёт бесконечность,
  // а не падение, — и позволяет оставить функции обычными значениями, а не особым случаем разбора.
  if: (condition, whenTrue, whenFalse) => (condition !== 0 ? whenTrue : whenFalse),
  and: (...args) => (args.every((value) => value !== 0) ? 1 : 0),
  or: (...args) => (args.some((value) => value !== 0) ? 1 : 0),
  not: (value) => (value === 0 ? 1 : 0),
};

export const FORMULA_FUNCTION_NAMES = Object.keys(FUNCTIONS);
export const FORMULA_CONSTANT_NAMES = Object.keys(CONSTANTS);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source.charAt(i);

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      let sawDot = false;
      while (j < source.length && /[0-9.]/.test(source.charAt(j))) {
        if (source.charAt(j) === '.') {
          if (sawDot) throw new FormulaError(`Неверное число рядом с позицией ${j + 1}`);
          sawDot = true;
        }
        j += 1;
      }
      const raw = source.slice(i, j);
      if (raw === '.' || raw === '') throw new FormulaError(`Неверное число рядом с позицией ${i + 1}`);
      tokens.push({ type: 'num', value: raw });
      i = j;
      continue;
    }

    if (/[a-zA-Zа-яА-Я_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[a-zA-Zа-яА-Я0-9_]/.test(source.charAt(j))) j += 1;
      tokens.push({ type: 'ident', value: source.slice(i, j) });
      i = j;
      continue;
    }

    // Двухсимвольные проверяются раньше односимвольных, иначе «<=» распалось бы на «<» и «=».
    const two = source.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if ('+-*/%^<>='.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i += 1;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i += 1;
      continue;
    }

    // Точка с запятой принимается наравне с запятой — так же, как в табличном движке: врач приходит
    // из русского Excel, где разделитель аргументов именно «;». Десятичный разделитель при этом
    // остаётся точкой, иначе «min(1,5;2)» нельзя было бы разобрать однозначно.
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'comma', value: ch });
      i += 1;
      continue;
    }

    throw new FormulaError(`Недопустимый символ «${ch}» в формуле`);
  }

  return tokens;
}

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(type?: TokenType): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new FormulaError('Формула обрывается раньше времени');
    if (type && token.type !== type) {
      throw new FormulaError(`Ожидался другой символ рядом с «${token.value}»`);
    }
    this.pos += 1;
    return token;
  }

  parse(): AstNode {
    if (this.tokens.length === 0) throw new FormulaError('Формула не может быть пустой');
    const node = this.parseExpr();
    if (this.pos !== this.tokens.length) {
      throw new FormulaError(`Лишние символы рядом с «${this.peek()?.value}»`);
    }
    return node;
  }

  /**
   * Сравнение стоит ниже сложения, как в Excel: `a + 1 > b` — это `(a + 1) > b`.
   *
   * Цепочки не бывает: `1 < x < 5` в математике значит одно, а слева направо посчиталось бы совсем
   * другое (`(1 < x) < 5`, то есть «ноль или единица меньше пяти» — всегда истина). Поэтому второе
   * сравнение подряд — ошибка, а не тихо неверный ответ. Такое условие пишется через `and`.
   */
  private parseExpr(): AstNode {
    const left = this.parseAdditive();
    const token = this.peek();
    if (token?.type !== 'op' || !COMPARE_OPS.includes(token.value as CompareOp)) return left;

    const op = this.consume().value as CompareOp;
    const right = this.parseAdditive();
    const next = this.peek();
    if (next?.type === 'op' && COMPARE_OPS.includes(next.value as CompareOp)) {
      throw new FormulaError('Два сравнения подряд писать нельзя — используйте and(…, …)');
    }
    return { type: 'cmp', op, left, right };
  }

  private parseAdditive(): AstNode {
    let node = this.parseTerm();
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.consume().value as '+' | '-';
      const right = this.parseTerm();
      node = { type: 'bin', op, left: node, right };
    }
    return node;
  }

  private parseTerm(): AstNode {
    let node = this.parsePower();
    while (
      this.peek()?.type === 'op' &&
      (this.peek()!.value === '*' || this.peek()!.value === '/' || this.peek()!.value === '%')
    ) {
      const op = this.consume().value as '*' | '/' | '%';
      const right = this.parsePower();
      node = { type: 'bin', op, left: node, right };
    }
    return node;
  }

  private parsePower(): AstNode {
    const node = this.parseUnary();
    if (this.peek()?.type === 'op' && this.peek()!.value === '^') {
      this.consume();
      const right = this.parsePower();
      return { type: 'bin', op: '^', left: node, right };
    }
    return node;
  }

  private parseUnary(): AstNode {
    if (this.peek()?.type === 'op' && this.peek()!.value === '-') {
      this.consume();
      return { type: 'unary', op: '-', arg: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const token = this.peek();
    if (!token) throw new FormulaError('Формула обрывается раньше времени');

    if (token.type === 'num') {
      this.consume();
      return { type: 'num', value: Number(token.value) };
    }

    if (token.type === 'lparen') {
      this.consume();
      const node = this.parseExpr();
      this.consume('rparen');
      return node;
    }

    if (token.type === 'ident') {
      this.consume();
      if (this.peek()?.type === 'lparen') {
        this.consume();
        const args: AstNode[] = [];
        if (this.peek()?.type !== 'rparen') {
          args.push(this.parseExpr());
          while (this.peek()?.type === 'comma') {
            this.consume();
            args.push(this.parseExpr());
          }
        }
        this.consume('rparen');
        if (!FUNCTIONS[token.value]) {
          throw new FormulaError(`Неизвестная функция «${token.value}»`);
        }
        return { type: 'call', name: token.value, args };
      }
      return { type: 'var', name: token.value };
    }

    throw new FormulaError(`Неожиданный символ «${token.value}»`);
  }
}

export function parseFormula(formula: string): AstNode {
  return new Parser(tokenize(formula)).parse();
}

function evaluateNode(node: AstNode, variables: Record<string, number>): number {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'var': {
      // Проверяется само значение, а не наличие ключа: поле формы, дошедшее сюда как `undefined`,
      // при проверке через `in` возвращалось бы наружу числом, которого нет.
      const value = variables[node.name];
      if (value !== undefined) return value;
      const constant = CONSTANTS[node.name];
      if (constant !== undefined) return constant;
      throw new FormulaError(`Неизвестная переменная «${node.name}»`);
    }
    case 'unary':
      return -evaluateNode(node.arg, variables);
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError(`Неизвестная функция «${node.name}»`);
      return fn(...node.args.map((arg) => evaluateNode(arg, variables)));
    }
    case 'cmp': {
      const left = evaluateNode(node.left, variables);
      const right = evaluateNode(node.right, variables);
      switch (node.op) {
        case '<':
          return left < right ? 1 : 0;
        case '<=':
          return left <= right ? 1 : 0;
        case '>':
          return left > right ? 1 : 0;
        case '>=':
          return left >= right ? 1 : 0;
        case '=':
          return left === right ? 1 : 0;
        case '<>':
          return left !== right ? 1 : 0;
      }
    }
    case 'bin': {
      const left = evaluateNode(node.left, variables);
      const right = evaluateNode(node.right, variables);
      switch (node.op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '%':
          return left % right;
        case '^':
          return Math.pow(left, right);
      }
    }
  }
}

export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  const ast = parseFormula(formula);
  return evaluateNode(ast, variables);
}

export function getFormulaVariables(formula: string): string[] {
  const ast = parseFormula(formula);
  const names = new Set<string>();

  function walk(node: AstNode) {
    if (node.type === 'var' && !(node.name in CONSTANTS)) {
      names.add(node.name);
    } else if (node.type === 'unary') {
      walk(node.arg);
    } else if (node.type === 'bin' || node.type === 'cmp') {
      walk(node.left);
      walk(node.right);
    } else if (node.type === 'call') {
      node.args.forEach(walk);
    }
  }

  walk(ast);
  return Array.from(names);
}
