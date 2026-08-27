import { describe, expect, it } from 'vitest';

import { completeFunction, formulaHint, signatureParts } from './formulaHint';
import { FUNCTION_DOCS } from './formula';

/** Курсор задаётся знаком | в строке — так проверки читаются как то, что видит врач. */
function hintAt(withCaret: string) {
  const caret = withCaret.indexOf('|');
  return formulaHint(withCaret.replace('|', ''), caret);
}

describe('formulaHint', () => {
  it('молчит на обычной ячейке', () => {
    expect(hintAt('Иванов|')).toBeNull();
    expect(hintAt('14|')).toBeNull();
  });

  it('на голом знаке равенства показывает всё, что бывает', () => {
    const hint = hintAt('=|');
    expect(hint).toMatchObject({ kind: 'functions', prefix: '' });
    expect(hint && hint.kind === 'functions' && hint.matches).toHaveLength(FUNCTION_DOCS.length);
  });

  it('подбирает функции по началу имени', () => {
    const hint = hintAt('=СУ|');
    expect(hint?.kind).toBe('functions');
    expect(hint && hint.kind === 'functions' && hint.matches.map((doc) => doc.name)).toEqual(['СУММ']);
  });

  it('английское начало имени работает наравне с русским', () => {
    const hint = hintAt('=SU|');
    expect(hint && hint.kind === 'functions' && hint.matches.map((doc) => doc.name)).toEqual(['СУММ']);
  });

  it('после открытой скобки показывает подпись, а не список', () => {
    const hint = hintAt('=СУММ(|');
    expect(hint).toMatchObject({ kind: 'signature', argument: 0 });
    expect(hint && hint.kind === 'signature' && hint.doc.name).toBe('СУММ');
  });

  it('считает номер аргумента по разделителям', () => {
    expect(hintAt('=ЕСЛИ(B2>1;|')).toMatchObject({ kind: 'signature', argument: 1 });
    expect(hintAt('=ЕСЛИ(B2>1;"да";|')).toMatchObject({ kind: 'signature', argument: 2 });
    // Запятая — тот же разделитель: формула могла прийти из англоязычного файла.
    expect(hintAt('=ОКРУГЛ(B2,|')).toMatchObject({ kind: 'signature', argument: 1 });
  });

  it('вложенный вызов подсказывает про себя, а не про внешний', () => {
    expect(hintAt('=СУММ(ОКРУГЛ(|')).toMatchObject({ kind: 'signature', argument: 0 });
    const hint = hintAt('=СУММ(ОКРУГЛ(|');
    expect(hint && hint.kind === 'signature' && hint.doc.name).toBe('ОКРУГЛ');
  });

  it('закрытая скобка возвращает подсказку внешнему вызову', () => {
    const hint = hintAt('=СУММ(ОКРУГЛ(B2;2);|');
    expect(hint && hint.kind === 'signature' && hint.doc.name).toBe('СУММ');
    expect(hint).toMatchObject({ argument: 1 });
  });

  it('имя, набираемое внутри скобок, важнее подписи внешней функции', () => {
    // Иначе в «=СУММ(СР» показывалась бы подпись СУММ — правильная, но не про то, что печатают.
    const hint = hintAt('=СУММ(СР|');
    expect(hint && hint.kind === 'functions' && hint.matches.map((doc) => doc.name)).toEqual(['СРЗНАЧ']);
  });

  it('внутри текста в кавычках молчит', () => {
    expect(hintAt('=ЕСЛИ(B2>1;"СУ|')).toBeNull();
  });

  it('скобка внутри кавычек скобку не открывает', () => {
    expect(hintAt('="раз (два";|')).toBeNull();
  });

  it('незнакомое имя не выдумывает подпись', () => {
    expect(hintAt('=ВПР(|')).toBeNull();
  });

  it('ссылки за подсказкой не идут', () => {
    expect(hintAt('=B2|')).toBeNull();
  });
});

describe('completeFunction', () => {
  it('заменяет набранный кусок и ставит скобку', () => {
    expect(completeFunction('=СУ', 3, 'СУММ')).toEqual({ text: '=СУММ(', caret: 6 });
  });

  it('вставляет по месту курсора, не трогая хвост', () => {
    expect(completeFunction('=СУ+B2', 3, 'СУММ')).toEqual({ text: '=СУММ(+B2', caret: 6 });
  });

  it('на голом знаке равенства просто дописывает', () => {
    expect(completeFunction('=', 1, 'СУММ')).toEqual({ text: '=СУММ(', caret: 6 });
  });
});

describe('signatureParts', () => {
  it('отмечает текущий аргумент', () => {
    const parts = signatureParts(FUNCTION_DOCS.find((doc) => doc.name === 'ЕСЛИ')!, 1);
    expect(parts.map((part) => part.text)).toEqual(['условие', 'если да', 'если нет']);
    expect(parts.map((part) => part.current)).toEqual([false, true, false]);
  });

  it('лишние аргументы подсвечивают последний — он повторяемый', () => {
    const parts = signatureParts(FUNCTION_DOCS.find((doc) => doc.name === 'СУММ')!, 5);
    expect(parts[parts.length - 1].current).toBe(true);
  });

  it('у каждой функции есть имена аргументов', () => {
    for (const doc of FUNCTION_DOCS) {
      expect(signatureParts(doc, 0).length, doc.name).toBeGreaterThan(0);
      expect(signatureParts(doc, 0)[0].text, doc.name).not.toBe('значение');
    }
  });
});
