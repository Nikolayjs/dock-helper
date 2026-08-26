/**
 * Адреса ячеек: `A1`, `$C$4`, `B2:B10` — та же система, что в Excel.
 *
 * Здесь же живёт сдвиг ссылок внутри формулы. Он нужен в двух местах, и оба обязаны вести себя
 * одинаково: при сортировке строк (формула `=B5*600` уезжает вместе со своей строкой и должна
 * считать по новой) и при чтении «общих» формул из чужого .xlsx, где Excel хранит текст только у
 * первой ячейки столбца, а остальным оставляет ссылку на неё.
 */

/** Номер строки, с которого начинаются данные: первая строка листа — заголовки. */
export const HEADER_ROW = 1;
export const FIRST_DATA_ROW = 2;

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/** A → 0, Z → 25, AA → 26. Регистр не важен. */
export function columnIndex(letters: string): number {
  let result = 0;
  for (const char of letters.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }
  return result - 1;
}

export interface CellRef {
  /** 0-based индекс столбца. */
  col: number;
  /** 1-based номер строки — как в Excel, где первая строка листа это заголовки. */
  row: number;
  colAbsolute: boolean;
  rowAbsolute: boolean;
}

/**
 * Столбцы в Excel обозначаются только латиницей, и это здесь важно: русские имена функций
 * (`СУММ`, `СРЗНАЧ`) написаны кириллицей и потому не могут быть перепутаны со ссылкой.
 */
const REF_PATTERN = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/g;

export function parseRef(text: string): CellRef | null {
  const match = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/.exec(text);
  if (!match) return null;
  return {
    col: columnIndex(match[2]),
    row: Number(match[4]),
    colAbsolute: match[1] === '$',
    rowAbsolute: match[3] === '$',
  };
}

export function formatRef(ref: CellRef): string {
  return `${ref.colAbsolute ? '$' : ''}${columnLetter(ref.col)}${ref.rowAbsolute ? '$' : ''}${ref.row}`;
}

/**
 * Сдвигает относительные ссылки формулы на заданное число строк и столбцов.
 *
 * Абсолютные (`$A$1`) не двигаются — в этом и состоит весь их смысл: строка итогов, на которую
 * ссылается каждая строка таблицы, не должна разъезжаться при сортировке.
 *
 * Ссылка, уехавшая за границу листа, становится `#ССЫЛ!` — как в Excel, и по той же причине: молча
 * подставить нулевую строку значило бы посчитать не то и не сказать об этом.
 *
 * Текст в кавычках не трогается: `="A1 не считается"` — это строка, а не ссылка.
 */
export function shiftFormula(formula: string, deltaRow: number, deltaColumn: number): string {
  if (deltaRow === 0 && deltaColumn === 0) return formula;

  let result = '';
  let index = 0;
  let quoted = false;

  while (index < formula.length) {
    const char = formula[index];
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

    REF_PATTERN.lastIndex = index;
    const match = REF_PATTERN.exec(formula);
    if (match && match.index === index && !isPartOfName(formula, index, match[0].length)) {
      const ref = parseRef(match[0])!;
      const shifted: CellRef = {
        ...ref,
        col: ref.colAbsolute ? ref.col : ref.col + deltaColumn,
        row: ref.rowAbsolute ? ref.row : ref.row + deltaRow,
      };
      result += shifted.col < 0 || shifted.row < HEADER_ROW ? '#REF!' : formatRef(shifted);
      index += match[0].length;
      continue;
    }

    result += char;
    index++;
  }

  return result;
}

/**
 * `A1` внутри `LOG10(...)` или сразу после буквы — не ссылка.
 *
 * Проверяется и то, что стоит перед совпадением, и то, что идёт после: имя функции узнаётся по
 * открывающей скобке, а продолжение слова — по букве или цифре.
 */
function isPartOfName(formula: string, start: number, length: number): boolean {
  const before = start > 0 ? formula[start - 1] : '';
  const after = formula[start + length] ?? '';
  return /[A-Za-zА-Яа-яЁё0-9_.]/.test(before) || after === '(' || /[A-Za-zА-Яа-яЁё_]/.test(after);
}
