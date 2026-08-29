import { FUNCTION_DOCS, isFormula, type FunctionDoc } from './formula';

/**
 * Подсказка по формуле, которую врач набирает прямо сейчас.
 *
 * Три состояния, и они разные по смыслу. Пока набирается имя — нужен список того, что вообще
 * бывает: `=СУ` должно предложить `СУММ`. Как только скобка открыта — имя уже выбрано, и вопрос
 * другой: что писать внутри. Показывать в этот момент список функций бесполезно, а показывать
 * подпись до открытия скобки нечего.
 *
 * Третье — про формулы без функций вовсе. `=B2*600` и `=A1+A2` — самое частое, что пишут в реестре,
 * и до сих пор они не подсказывали ничего: список функций к ним не подходит, подписи у них нет.
 * Здесь нужен не справочник, а то, чего в самой формуле не видно, — **что стоит в ячейках, на
 * которые она ссылается**. Опечатку в адресе (`B2` вместо `B3`) иначе не поймать: формула считается
 * без единой жалобы, просто не то.
 */
export type FormulaHint =
  | { kind: 'functions'; prefix: string; matches: FunctionDoc[] }
  | { kind: 'signature'; doc: FunctionDoc; argument: number }
  | { kind: 'references'; refs: string[] };

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
    else if (char === ';' || char === ',') {
      const open = stack[stack.length - 1];
      if (open) open.argument++;
    }
  }

  return stack[stack.length - 1] ?? null;
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

  const typed = /([A-Za-zА-Яа-яЁё]+)$/.exec(before)?.[1];
  if (typed) {
    const matches = matching(typed);
    if (matches.length > 0) return { kind: 'functions', prefix: typed, matches };
  }

  const call = openCall(before, before.length);
  if (call) {
    const name = /([A-Za-zА-Яа-яЁё]+)$/.exec(before.slice(0, call.at))?.[1];
    const doc = name ? findDoc(name) : undefined;
    if (doc) return { kind: 'signature', doc, argument: call.argument };
  }

  // Пустая формула — повод напомнить, с чего начать.
  if (before.trim() === '=') return { kind: 'functions', prefix: '', matches: FUNCTION_DOCS };

  const refs = referencesIn(text);
  if (refs.length > 0) return { kind: 'references', refs };

  return null;
}

/**
 * Все ссылки на ячейки и диапазоны в формуле, в порядке появления и без повторов.
 *
 * Содержимое кавычек пропускается: `"A1"` — это текст, а не адрес. Имя функции ссылкой не станет,
 * даже английское: у адреса обязательно есть цифры, а у `SUM` их нет.
 */
export function referencesIn(text: string): string[] {
  const bare = text.replace(/"[^"]*"?/g, ' ');
  const found = bare.match(/\$?[A-Za-z]{1,3}\$?\d{1,7}(?::\$?[A-Za-z]{1,3}\$?\d{1,7})?/g) ?? [];
  const unique: string[] = [];
  for (const ref of found) {
    const upper = ref.toUpperCase();
    if (!unique.includes(upper)) unique.push(upper);
  }
  return unique;
}

/**
 * Подставляет выбранную функцию вместо набранного куска имени.
 *
 * Возвращает новый текст и место, куда встать курсором — сразу за открывающей скобкой: аргументы
 * всё равно печатать следом, и заставлять врача ставить скобку самому незачем.
 */
export function completeFunction(text: string, caret: number, name: string): { text: string; caret: number } {
  const before = text.slice(0, caret);
  const typed = /([A-Za-zА-Яа-яЁё]+)$/.exec(before)?.[1];
  const start = typed ? caret - typed.length : caret;
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
