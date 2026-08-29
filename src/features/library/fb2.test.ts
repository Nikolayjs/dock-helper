// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { parseFb2 } from './fb2';

/**
 * Читалка FB2 собирает разметку строками из содержимого чужого файла.
 *
 * Проверяется место, где это ломалось: `content-type` картинки уходил в `data:`-адрес как есть, а
 * адрес — в атрибут `src` без экранирования. Кавычка в этом атрибуте вырывала значение из атрибута
 * и дальше писала в разметку что угодно.
 */

const book = (binaryAttrs: string, body = '<section><p>Текст</p><image l:href="#pic"/></section>') => `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns:l="http://www.w3.org/1999/xlink">
  <description><title-info><book-title>Книга</book-title></title-info></description>
  <body>${body}</body>
  <binary ${binaryAttrs}>iVBORw0KGgo=</binary>
</FictionBook>`;

describe('картинка из чужого файла', () => {
  it('обычный тип проходит', () => {
    const parsed = parseFb2(book('id="pic" content-type="image/png"'));
    expect(parsed.bodyHtml).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  it('кавычка в типе не вырывается из атрибута', () => {
    const parsed = parseFb2(book('id="pic" content-type=\'image/png" onload="alert(1)\''));
    expect(parsed.bodyHtml).not.toContain('onload');
    // Незнакомый тип читается как JPEG, а не подставляется дословно.
    expect(parsed.bodyHtml).toContain('data:image/jpeg;base64,');
  });

  it('svg картинкой не считается — это документ со своими скриптами', () => {
    const parsed = parseFb2(book('id="pic" content-type="image/svg+xml"'));
    expect(parsed.bodyHtml).not.toContain('svg');
    expect(parsed.bodyHtml).toContain('data:image/jpeg;base64,');
  });

  it('в base64 не остаётся посторонних символов', () => {
    const parsed = parseFb2(book('id="pic" content-type="image/png"'));
    const src = /src="([^"]*)"/.exec(parsed.bodyHtml)?.[1] ?? '';
    expect(src.split('base64,')[1]).toMatch(/^[A-Za-z0-9+/=]*$/);
  });
});

describe('текст книги', () => {
  it('угловые скобки в тексте остаются текстом', () => {
    const parsed = parseFb2(book('id="pic" content-type="image/png"', '<section><p>a &lt; b и &lt;script&gt;</p></section>'));
    expect(parsed.bodyHtml).toContain('&lt;script&gt;');
    expect(parsed.bodyHtml).not.toContain('<script>');
  });

  it('название книги читается', () => {
    expect(parseFb2(book('id="pic" content-type="image/png"')).title).toBe('Книга');
  });
});
