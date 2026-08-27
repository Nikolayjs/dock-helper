import { FUNCTION_DOCS, isFormula, type FunctionDoc } from './formula';

/**
 * Подсказка по формуле, которую врач набирает прямо сейчас.
 *
 * Два состояния, и они разные по смыслу. Пока набирается имя — нужен список того, что вообще
 * бывает: `=СУ` должно предложить `СУММ`. Как только скобка открыта — имя уже выбрано, и вопрос
 * другой: что писать внутри. Показывать в этот момент список функций бесполезно, а показывать
 * подпись до открытия скобки нечего.
 */
export type FormulaHint =
  | { kind: 'functions'; prefix: string; matches: FunctionDoc[] }
  | { kind: 'signature'; doc: FunctionDoc; argument: number };

/** Имя функции считается по-русски и по-английски: вычислитель принимает оба. */
function matching(prefix: string): FunctionDoc[] {
  const upper = prefix.toUpperCase();
  return FUNCTION_DOCS.filter((doc) => doc.name.startsWith(upper) || doc.english.startsWith(upper));
}

function findDoc(name: string): FunctionDoc | undefined {
  const upper = name.toUpperCase();
  return FUNCTION_DOCS.find((doc) => doc.name === upper || doc.english === upper);
}

/**
 * Разбирает начало формулы до курсора.
 *
 * Возвращает позицию открытой и незакрытой скобки, внутри которой стоит курсор, и число
 * разделителей после неё — то есть номер аргумента. Текст в кавычках пропускается: `"СУММ("` внутри
 * строки скобку не открывает.
 */
function openCall(text: string, caret: number): { at: number; argument: number } | null {
  const stack: { at: number; argument: number }[] = [];
  let quoted = false;

  for (let index = 0; index < caret && index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === '(') stack.push({ at: index, argument: 0 });
    else if (char === ')') stack.pop();
    else if ((char === ';' || char === ',') && stack.length > 0) stack[stack.length - 1].argument++;
  }

  return stack.length > 0 ? stack[stack.length - 1] : null;
}

/**
 * Что подсказать при данном положении курсора; `null` — если подсказывать нечего.
 *
 * Порядок проверок важен: сначала набираемое имя, потом открытая скобка. Иначе в `=СУММ(СР` вместо
 * списка со `СРЗНАЧ` показывалась бы подпись `СУММ` — правильная, но не про то, что печатают.
 */
export function formulaHint(text: string, caret: number): FormulaHint | null {
  if (!isFormula(text)) return null;
  const before = text.slice(0, Math.max(0, Math.min(caret, text.length)));

  // Незакрытая кавычка — внутри текста, там подсказывать нечего.
  if ((before.match(/"/g)?.length ?? 0) % 2 === 1) return null;

  const typed = /([A-Za-zА-Яа-яЁё]+)$/.exec(before);
  if (typed) {
    const matches = matching(typed[1]);
    if (matches.length > 0) return { kind: 'functions', prefix: typed[1], matches };
  }

  const call = openCall(before, before.length);
  if (call) {
    const name = /([A-Za-zА-Яа-яЁё]+)$/.exec(before.slice(0, call.at));
    const doc = name ? findDoc(name[1]) : undefined;
    if (doc) return { kind: 'signature', doc, argument: call.argument };
  }

  // Пустая формула — повод напомнить, с чего начать.
  if (before.trim() === '=') return { kind: 'functions', prefix: '', matches: FUNCTION_DOCS };

  return null;
}

/**
 * Подставляет выбранную функцию вместо набранного куска имени.
 *
 * Возвращает новый текст и место, куда встать курсором — сразу за открывающей скобкой: аргументы
 * всё равно печатать следом, и заставлять врача ставить скобку самому незачем.
 */
export function completeFunction(text: string, caret: number, name: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const typed = /([A-Za-zА-Яа-яЁё]+)$/.exec(before);
  const start = typed ? caret - typed[1].length : caret;
  const inserted = `${name}(`;
  return {
    text: text.slice(0, start) + inserted + text.slice(caret),
    caret: start + inserted.length,
  };
}

/** Подпись функции с выделенным текущим аргументом — как её показывает Excel. */
export function signatureParts(doc: FunctionDoc, argument: number): { text: string; current: boolean }[] {
  const args = ARGUMENTS[doc.english] ?? ['значение'];
  return args.map((name, index) => ({ text: name, current: index === argument || (index === args.length - 1 && argument >= args.length) }));
}

/** Имена аргументов — по-русски, как в подсказке русского Excel. */
const ARGUMENTS: Record<string, string[]> = {
  SUM: ['число или диапазон', '…'],
  AVERAGE: ['число или диапазон', '…'],
  MIN: ['число или диапазон', '…'],
  MAX: ['число или диапазон', '…'],
  COUNT: ['диапазон', '…'],
  COUNTA: ['диапазон', '…'],
  PRODUCT: ['число или диапазон', '…'],
  ROUND: ['число', 'знаков после запятой'],
  INT: ['число'],
  ABS: ['число'],
  IF: ['условие', 'если да', 'если нет'],
};
