/**
 * Вычислитель формул для таблиц документа.
 *
 * Написан руками по той же причине, что `writeXlsx` и `writeDocx`: на входе не произвольная книга
 * Excel, а короткий список того, что осмысленно в реестре врача — арифметика, ссылки, диапазоны и
 * десяток функций. Полноценный движок умеет ВПР, сводные и массивы, весит сотни килобайт и всё
 * равно расходится с Excel на краях; конвертер под свою схему — четыреста строк и падает заметно.
 *
 * Формулой ячейка считается, если начинается с `=`. Вычисленное значение нужно в трёх местах:
 * в редакторе (показать результат вместо текста формулы), в просмотре и при выгрузке — там оно
 * становится закешированным значением рядом с настоящей формулой, чтобы Excel показал число сразу,
 * а при первом же пересчёте заменил его своим.
 */
import { columnLetter, parseRef, type CellRef } from './cellRef';

/** Ошибки печатаются по-русски, как в русском Excel: врач видит их, а не английский оригинал. */
export const ERRORS = {
  div0: '#ДЕЛ/0!',
  value: '#ЗНАЧ!',
  name: '#ИМЯ?',
  ref: '#ССЫЛ!',
  cycle: '#ЦИКЛ!',
  num: '#ЧИСЛО!',
} as const;

export type ErrorText = (typeof ERRORS)[keyof typeof ERRORS];

/** Соответствие русских ошибок английским: в файл .xlsx уходят только английские. */
const ERROR_TO_EXCEL: Record<string, string> = {
  [ERRORS.div0]: '#DIV/0!',
  [ERRORS.value]: '#VALUE!',
  [ERRORS.name]: '#NAME?',
  [ERRORS.ref]: '#REF!',
  // У Excel нет отдельной ошибки цикла — он сообщает о ней диалогом и оставляет ноль. В файле
  // честнее написать #VALUE!, чем притвориться, что значение есть.
  [ERRORS.cycle]: '#VALUE!',
  [ERRORS.num]: '#NUM!',
};

export interface CellError {
  error: ErrorText;
}

export type CellValue = number | string | boolean | CellError;

export function isError(value: CellValue): value is CellError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export function isFormula(raw: string): boolean {
  return raw.trimStart().startsWith('=');
}

// ─── Имена функций ───────────────────────────────────────────────────────────

/**
 * Русские имена — то, что врач печатает: русский Excel показывает `СУММ`, а не `SUM`.
 *
 * В файле имена всегда английские — формат этого требует независимо от языка интерфейса, и русский
 * Excel сам покажет их по-русски. Английские имена принимаются тоже: формула, скопированная из
 * англоязычного файла, должна работать без перевода.
 */
const FUNCTION_ALIASES: Record<string, string> = {
  СУММ: 'SUM',
  СРЗНАЧ: 'AVERAGE',
  МИН: 'MIN',
  МАКС: 'MAX',
  'СЧЁТ': 'COUNT',
  СЧЕТ: 'COUNT',
  'СЧЁТЗ': 'COUNTA',
  СЧЕТЗ: 'COUNTA',
  ОКРУГЛ: 'ROUND',
  ЕСЛИ: 'IF',
  ABS: 'ABS',
  ПРОИЗВЕД: 'PRODUCT',
  ЦЕЛОЕ: 'INT',
};

const ENGLISH_NAMES = new Set(['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'COUNTA', 'ROUND', 'IF', 'ABS', 'PRODUCT', 'INT']);

/** Имя функции в каноническом (английском) виде; `null`, если такой функции нет. */
function canonicalName(name: string): string | null {
  const upper = name.toUpperCase();
  if (ENGLISH_NAMES.has(upper)) return upper;
  return FUNCTION_ALIASES[upper] ?? null;
}

/** Все имена, которые принимает вычислитель — для подсказки в редакторе. */
export const KNOWN_FUNCTIONS = Object.keys(FUNCTION_ALIASES).filter((name) => /[А-Яа-яЁё]/.test(name));

// ─── Разбор ──────────────────────────────────────────────────────────────────

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'ref'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string }
  | { kind: 'sep' }
  | { kind: 'open' }
  | { kind: 'close' }
  | { kind: 'colon' };

class ParseError extends Error {
  readonly code: ErrorText;

  constructor(code: ErrorText) {
    super(code);
    this.code = code;
  }
}

/**
 * Разделитель аргументов — и запятая, и точка с запятой.
 *
 * Русский Excel пишет точку с запятой, английский — запятую, и формула, скопированная откуда
 * угодно, должна работать. Десятичный разделитель при этом только точка: запятая уже занята
 * разделителем аргументов, и `СУММ(1,5;2)` иначе не разобрать однозначно.
 */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (char === ' ' || char === '\t' || char === '\n') {
      index++;
      continue;
    }
    if (char === '"') {
      let value = '';
      index++;
      while (index < source.length && source[index] !== '"') {
        value += source[index];
        index++;
      }
      if (index >= source.length) throw new ParseError(ERRORS.value);
      index++;
      tokens.push({ kind: 'string', value });
      continue;
    }
    if (char === '(') {
      tokens.push({ kind: 'open' });
      index++;
      continue;
    }
    if (char === ')') {
      tokens.push({ kind: 'close' });
      index++;
      continue;
    }
    if (char === ',' || char === ';') {
      tokens.push({ kind: 'sep' });
      index++;
      continue;
    }
    if (char === ':') {
      tokens.push({ kind: 'colon' });
      index++;
      continue;
    }

    const twoChar = source.slice(index, index + 2);
    if (twoChar === '<=' || twoChar === '>=' || twoChar === '<>') {
      tokens.push({ kind: 'op', value: twoChar });
      index += 2;
      continue;
    }
    if ('+-*/^=<>&%'.includes(char)) {
      tokens.push({ kind: 'op', value: char });
      index++;
      continue;
    }

    const number = /^\d+(\.\d+)?/.exec(source.slice(index));
    if (number) {
      tokens.push({ kind: 'number', value: Number(number[0]) });
      index += number[0].length;
      continue;
    }

    // Ссылка узнаётся по латинским буквам с цифрами; всё остальное словесное — имя функции.
    const ref = /^\$?[A-Za-z]{1,3}\$?\d{1,7}(?![A-Za-zА-Яа-яЁё0-9_(])/.exec(source.slice(index));
    if (ref) {
      tokens.push({ kind: 'ref', value: ref[0] });
      index += ref[0].length;
      continue;
    }

    const name = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*/.exec(source.slice(index));
    if (name) {
      tokens.push({ kind: 'name', value: name[0] });
      index += name[0].length;
      continue;
    }

    throw new ParseError(ERRORS.value);
  }

  return tokens;
}

type Node =
  | { kind: 'literal'; value: CellValue }
  | { kind: 'ref'; ref: CellRef }
  | { kind: 'range'; from: CellRef; to: CellRef }
  | { kind: 'unary'; op: string; operand: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] };

/**
 * Рекурсивный спуск по обычной для формул иерархии: сравнение слабее сложения, сложение слабее
 * умножения, степень сильнее всех и правоассоциативна.
 */
class Parser {
  private position = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Node {
    const node = this.comparison();
    if (this.position < this.tokens.length) throw new ParseError(ERRORS.value);
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private comparison(): Node {
    let left = this.sum();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(token.value)) {
        this.position++;
        left = { kind: 'binary', op: token.value, left, right: this.sum() };
      } else return left;
    }
  }

  private sum(): Node {
    let left = this.product();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'op' && (token.value === '+' || token.value === '-' || token.value === '&')) {
        this.position++;
        left = { kind: 'binary', op: token.value, left, right: this.product() };
      } else return left;
    }
  }

  private product(): Node {
    let left = this.power();
    for (;;) {
      const token = this.peek();
      if (token?.kind === 'op' && (token.value === '*' || token.value === '/')) {
        this.position++;
        left = { kind: 'binary', op: token.value, left, right: this.power() };
      } else return left;
    }
  }

  private power(): Node {
    const base = this.unary();
    const token = this.peek();
    if (token?.kind === 'op' && token.value === '^') {
      this.position++;
      return { kind: 'binary', op: '^', left: base, right: this.power() };
    }
    return base;
  }

  private unary(): Node {
    const token = this.peek();
    if (token?.kind === 'op' && (token.value === '-' || token.value === '+')) {
      this.position++;
      return { kind: 'unary', op: token.value, operand: this.unary() };
    }
    return this.primary();
  }

  private primary(): Node {
    const token = this.peek();
    if (!token) throw new ParseError(ERRORS.value);

    if (token.kind === 'number') {
      this.position++;
      return { kind: 'literal', value: token.value };
    }
    if (token.kind === 'string') {
      this.position++;
      return { kind: 'literal', value: token.value };
    }
    if (token.kind === 'ref') {
      this.position++;
      const from = parseRef(token.value);
      if (!from) throw new ParseError(ERRORS.ref);
      if (this.peek()?.kind === 'colon') {
        this.position++;
        const next = this.peek();
        if (next?.kind !== 'ref') throw new ParseError(ERRORS.ref);
        this.position++;
        const to = parseRef(next.value);
        if (!to) throw new ParseError(ERRORS.ref);
        return { kind: 'range', from, to };
      }
      return { kind: 'ref', ref: from };
    }
    if (token.kind === 'open') {
      this.position++;
      const inner = this.comparison();
      if (this.peek()?.kind !== 'close') throw new ParseError(ERRORS.value);
      this.position++;
      return inner;
    }
    if (token.kind === 'name') {
      this.position++;
      const name = canonicalName(token.value);
      if (!name) throw new ParseError(ERRORS.name);
      if (this.peek()?.kind !== 'open') throw new ParseError(ERRORS.name);
      this.position++;

      const args: Node[] = [];
      if (this.peek()?.kind === 'close') {
        this.position++;
        return { kind: 'call', name, args };
      }
      for (;;) {
        args.push(this.comparison());
        const next = this.peek();
        if (next?.kind === 'sep') {
          this.position++;
          continue;
        }
        if (next?.kind === 'close') {
          this.position++;
          return { kind: 'call', name, args };
        }
        throw new ParseError(ERRORS.value);
      }
    }

    throw new ParseError(ERRORS.value);
  }
}

// ─── Вычисление ──────────────────────────────────────────────────────────────

/**
 * Значение обычной, не формульной ячейки.
 *
 * Число распознаётся по тому же правилу, что при выгрузке: `007` и `89123456789` остаются текстом,
 * иначе формула складывала бы телефоны. Пустая ячейка — пустая строка, а не ноль: `СЧЁТ` не должен
 * их считать.
 */
export function literalValue(raw: string): CellValue {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (/^-?(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function toNumber(value: CellValue): number | CellError {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (isError(value)) return value;
  if (value === '') return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : { error: ERRORS.value };
}

function toText(value: CellValue): string {
  if (isError(value)) return value.error;
  if (typeof value === 'boolean') return value ? 'ИСТИНА' : 'ЛОЖЬ';
  if (typeof value === 'number') return formatNumber(value);
  return value;
}

/**
 * Число для показа и для файла.
 *
 * Двоичная дробь даёт `0.30000000000000004` там, где врач ждёт `0.3`; пятнадцать значащих цифр —
 * граница, за которой double всё равно врёт, и Excel округляет там же.
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return ERRORS.num;
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  return String(Number(value.toPrecision(15)));
}

type Cache = Map<string, CellValue>;

export interface GridSource {
  /** Строки листа целиком: нулевая — заголовки, дальше данные и, если есть, строка итогов. */
  grid: string[][];
}

const MAX_DEPTH = 64;

class Evaluator {
  private readonly cache: Cache = new Map();
  private readonly visiting = new Set<string>();
  private readonly grid: string[][];

  constructor(grid: string[][]) {
    this.grid = grid;
  }

  /** Значение ячейки по 1-based номеру строки Excel и 0-based индексу столбца. */
  valueAt(row: number, col: number): CellValue {
    const key = `${row}:${col}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    if (this.visiting.has(key)) return { error: ERRORS.cycle };
    const raw = this.grid[row - 1]?.[col];
    if (raw === undefined) return '';

    if (!isFormula(raw)) {
      const value = literalValue(raw);
      this.cache.set(key, value);
      return value;
    }

    this.visiting.add(key);
    let value: CellValue;
    try {
      value = this.evaluateFormula(raw, 0);
    } catch (error) {
      value = { error: error instanceof ParseError ? error.code : ERRORS.value };
    } finally {
      this.visiting.delete(key);
    }
    this.cache.set(key, value);
    return value;
  }

  evaluateFormula(raw: string, depth: number): CellValue {
    if (depth > MAX_DEPTH) return { error: ERRORS.cycle };
    const body = raw.trimStart().slice(1);
    if (body.trim() === '') return '';
    const node = new Parser(tokenize(body)).parse();
    return this.evaluateNode(node, depth);
  }

  private evaluateNode(node: Node, depth: number): CellValue {
    switch (node.kind) {
      case 'literal':
        return node.value;
      case 'ref':
        return this.valueAt(node.ref.row, node.ref.col);
      case 'range':
        // Диапазон сам по себе значения не имеет — только внутри функции, которая знает, что с ним
        // делать. `=A1:A5` в Excel тоже ошибка.
        return { error: ERRORS.value };
      case 'unary': {
        const operand = toNumber(this.evaluateNode(node.operand, depth + 1));
        if (typeof operand !== 'number') return operand;
        return node.op === '-' ? -operand : operand;
      }
      case 'binary':
        return this.evaluateBinary(node, depth);
      case 'call':
        return this.evaluateCall(node, depth);
    }
  }

  private evaluateBinary(node: Extract<Node, { kind: 'binary' }>, depth: number): CellValue {
    const left = this.evaluateNode(node.left, depth + 1);
    const right = this.evaluateNode(node.right, depth + 1);
    if (isError(left)) return left;
    if (isError(right)) return right;

    if (node.op === '&') return toText(left) + toText(right);

    if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) {
      const comparison = compare(left, right);
      switch (node.op) {
        case '=':
          return comparison === 0;
        case '<>':
          return comparison !== 0;
        case '<':
          return comparison < 0;
        case '>':
          return comparison > 0;
        case '<=':
          return comparison <= 0;
        default:
          return comparison >= 0;
      }
    }

    const a = toNumber(left);
    if (typeof a !== 'number') return a;
    const b = toNumber(right);
    if (typeof b !== 'number') return b;

    switch (node.op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return b === 0 ? { error: ERRORS.div0 } : a / b;
      case '^':
        return a ** b;
      default:
        return { error: ERRORS.value };
    }
  }

  /** Разворачивает аргумент в список значений: диапазон — в свои ячейки, всё прочее — в себя. */
  private spread(node: Node, depth: number): CellValue[] {
    if (node.kind !== 'range') return [this.evaluateNode(node, depth + 1)];

    const values: CellValue[] = [];
    const fromRow = Math.min(node.from.row, node.to.row);
    const toRow = Math.max(node.from.row, node.to.row);
    const fromCol = Math.min(node.from.col, node.to.col);
    const toCol = Math.max(node.from.col, node.to.col);

    for (let row = fromRow; row <= toRow; row++) {
      for (let col = fromCol; col <= toCol; col++) {
        values.push(this.valueAt(row, col));
      }
    }
    return values;
  }

  private evaluateCall(node: Extract<Node, { kind: 'call' }>, depth: number): CellValue {
    // ЕСЛИ обязано разбираться до вычисления аргументов: обе ветви считать незачем, а ветвь с
    // делением на ноль ещё и вернула бы ошибку там, где условие её никогда не выберет.
    if (node.name === 'IF') {
      if (node.args.length < 2) return { error: ERRORS.value };
      const condition = this.evaluateNode(node.args[0], depth + 1);
      if (isError(condition)) return condition;
      const truthy = typeof condition === 'boolean' ? condition : toNumber(condition) !== 0;
      const branch = truthy ? node.args[1] : node.args[2];
      return branch ? this.evaluateNode(branch, depth + 1) : false;
    }

    const values = node.args.flatMap((arg) => this.spread(arg, depth));
    const failure = values.find(isError);
    if (failure) return failure;

    const numbers = values.filter((value): value is number => typeof value === 'number');

    switch (node.name) {
      case 'SUM':
        return numbers.reduce((total, value) => total + value, 0);
      case 'PRODUCT':
        return numbers.length === 0 ? 0 : numbers.reduce((total, value) => total * value, 1);
      case 'AVERAGE':
        return numbers.length === 0 ? { error: ERRORS.div0 } : numbers.reduce((t, v) => t + v, 0) / numbers.length;
      case 'MIN':
        return numbers.length === 0 ? 0 : Math.min(...numbers);
      case 'MAX':
        return numbers.length === 0 ? 0 : Math.max(...numbers);
      case 'COUNT':
        return numbers.length;
      case 'COUNTA':
        return values.filter((value) => value !== '').length;
      case 'ABS': {
        const value = toNumber(values[0] ?? 0);
        return typeof value === 'number' ? Math.abs(value) : value;
      }
      case 'INT': {
        const value = toNumber(values[0] ?? 0);
        return typeof value === 'number' ? Math.floor(value) : value;
      }
      case 'ROUND': {
        const value = toNumber(values[0] ?? 0);
        if (typeof value !== 'number') return value;
        const digits = toNumber(values[1] ?? 0);
        if (typeof digits !== 'number') return digits;
        const factor = 10 ** Math.trunc(digits);
        return Math.round(value * factor) / factor;
      }
      default:
        return { error: ERRORS.name };
    }
  }
}

function compare(left: CellValue, right: CellValue): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  const a = toText(left);
  const b = toText(right);
  return a.localeCompare(b, 'ru');
}

// ─── Публичный вход ──────────────────────────────────────────────────────────

/**
 * Вычисляет весь лист.
 *
 * Возвращает **те же ссылки на строки**, в которых нет ни одной формулы. Редактор мемоизирует
 * строку по ссылке, и без этого правила таблица с одной формулой в подвале перерисовывалась бы
 * целиком на каждое нажатие клавиши.
 */
export function evaluateGrid(grid: string[][]): string[][] {
  if (!grid.some((row) => row.some(isFormula))) return grid;

  const evaluator = new Evaluator(grid);
  return grid.map((row, rowIndex) => {
    if (!row.some(isFormula)) return row;
    return row.map((raw, col) => (isFormula(raw) ? toText(evaluator.valueAt(rowIndex + 1, col)) : raw));
  });
}

/** Значение одной ячейки — для выгрузки, где нужен и тип, и текст. */
export function evaluateCell(grid: string[][], row: number, col: number): CellValue {
  return new Evaluator(grid).valueAt(row, col);
}

/** Ошибка в том виде, в каком её понимает Excel. */
export function excelError(error: ErrorText): string {
  return ERROR_TO_EXCEL[error] ?? '#VALUE!';
}

/**
 * Тело формулы для файла: русские имена функций заменены английскими, `;` — запятыми.
 *
 * Формат хранит имена только по-английски независимо от языка интерфейса, а русский Excel покажет
 * их по-русски сам. Текст в кавычках не трогается.
 */
export function formulaForExcel(raw: string): string {
  const body = raw.trimStart().slice(1);
  let result = '';
  let index = 0;
  let quoted = false;

  while (index < body.length) {
    const char = body[index];
    if (char === '"') {
      quoted = !quoted;
      result += char;
      index++;
      continue;
    }
    if (quoted) {
      result += char;
      index++;
      continue;
    }
    if (char === ';') {
      result += ',';
      index++;
      continue;
    }

    const name = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*(?=\s*\()/.exec(body.slice(index));
    if (name) {
      result += canonicalName(name[0]) ?? name[0];
      index += name[0].length;
      continue;
    }

    result += char;
    index++;
  }

  return result;
}

/** Обратный перевод: английские имена в русские. Строится из той же таблицы, чтобы не разъехаться. */
const ENGLISH_TO_RUSSIAN: Record<string, string> = Object.fromEntries(
  Object.entries(FUNCTION_ALIASES)
    .filter(([russian]) => /[А-Яа-яЁё]/.test(russian))
    .map(([russian, english]) => [english, russian]),
);

/**
 * Формула из файла — в том виде, в каком её печатает врач: русские имена, точка с запятой.
 *
 * Ради устойчивости по кругу: `=СУММ(B2:B3)`, выгруженное в файл как `SUM(B2:B3)` и загруженное
 * обратно, должно вернуться тем же `=СУММ(B2:B3)`, а не английским двойником. Незнакомое имя
 * остаётся как есть — и честно даёт `#ИМЯ?`, а не притворяется чем-то другим.
 */
export function formulaFromExcel(body: string): string {
  let result = '=';
  let index = 0;
  let quoted = false;

  while (index < body.length) {
    const char = body[index];
    if (char === '"') {
      quoted = !quoted;
      result += char;
      index++;
      continue;
    }
    if (quoted) {
      result += char;
      index++;
      continue;
    }
    if (char === ',') {
      result += ';';
      index++;
      continue;
    }

    const name = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*(?=\s*\()/.exec(body.slice(index));
    if (name) {
      result += ENGLISH_TO_RUSSIAN[name[0].toUpperCase()] ?? name[0];
      index += name[0].length;
      continue;
    }

    result += char;
    index++;
  }

  return result;
}

/** Адрес ячейки для подсказок в интерфейсе. */
export function cellAddress(row: number, col: number): string {
  return `${columnLetter(col)}${row}`;
}
