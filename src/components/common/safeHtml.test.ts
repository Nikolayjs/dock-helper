// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from './SafeHtml';

/**
 * Профиль чистки чужой разметки.
 *
 * Проверяется в обе стороны: и что опасное вырезано, и что **оформление документов, набранных до
 * сегодняшнего дня, уцелело**. Второе не менее важно: санитайзер, съевший выравнивание и картинки,
 * испортил бы каждую написанную справку разом.
 */

describe('вырезается опасное', () => {
  it('скрипт', () => {
    expect(sanitizeHtml('<p>текст</p><script>alert(1)</script>')).toBe('<p>текст</p>');
  });

  it('обработчик события на картинке', () => {
    const clean = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(clean).not.toContain('onerror');
  });

  it('javascript: в ссылке', () => {
    const clean = sanitizeHtml('<a href="javascript:alert(1)">ссылка</a>');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('ссылка');
  });

  it('iframe и object', () => {
    expect(sanitizeHtml('<iframe src="https://example.com"></iframe>')).toBe('');
    expect(sanitizeHtml('<object data="x"></object>')).toBe('');
  });

  it('форма — это чужая отправка на чужой адрес', () => {
    const clean = sanitizeHtml('<form action="https://example.com"><input name="a"></form>');
    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('<input');
  });

  it('тег style — он утёк бы на всю страницу, а не на документ', () => {
    expect(sanitizeHtml('<style>body{display:none}</style><p>текст</p>')).toBe('<p>текст</p>');
  });

  it('фамилия с угловой скобкой не становится разметкой', () => {
    // Ровно тот случай, ради которого экранируются подстановки бланка.
    expect(sanitizeHtml('<p>Иванов &lt;b&gt; Иван</p>')).toBe('<p>Иванов &lt;b&gt; Иван</p>');
  });
});

describe('оформление документов уцелевает', () => {
  it('начертания и заголовки', () => {
    const html = '<h2>Заголовок</h2><p><strong>жирный</strong> <em>курсив</em> <u>подчёркнутый</u> <s>зачёркнутый</s></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('маркер, индексы и код', () => {
    const html = '<p><mark>маркер</mark> H<sub>2</sub>O, м<sup>2</sup>, <code>код</code></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('выравнивание и цвет — они живут в атрибуте style', () => {
    const clean = sanitizeHtml('<p style="text-align: center; color: rgb(201, 42, 42)">по центру</p>');
    expect(clean).toContain('text-align');
    expect(clean).toContain('color');
  });

  it('списки, в том числе список задач', () => {
    const html = '<ul data-type="taskList"><li data-checked="true"><p>сделано</p></li></ul>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('data-type="taskList"');
    expect(clean).toContain('data-checked="true"');
  });

  it('таблицы вместе с объединением ячеек и шириной столбца', () => {
    const html = '<table><tbody><tr><th colspan="2" colwidth="120">Шапка</th></tr><tr><td>Ячейка</td><td>Вторая</td></tr></tbody></table>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('colspan="2"');
    expect(clean).toContain('colwidth="120"');
    expect(clean).toContain('Ячейка');
  });

  it('картинка из Word лежит в самом документе строкой data:', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const clean = sanitizeHtml(`<img src="${png}" width="320" alt="снимок">`);
    expect(clean).toContain(png);
    expect(clean).toContain('width="320"');
  });

  it('обычная ссылка остаётся ссылкой', () => {
    const clean = sanitizeHtml('<a href="https://example.com" target="_blank" rel="noopener">сайт</a>');
    expect(clean).toContain('href="https://example.com"');
    expect(clean).toContain('target="_blank"');
  });

  it('ссылка базы знаний сохраняет то, по чему делается переход', () => {
    const clean = sanitizeHtml('<a href="/articles/1" data-doc-link="1" class="wikilink">Название</a>');
    expect(clean).toContain('data-doc-link="1"');
    expect(clean).toContain('class="wikilink"');
  });

  it('разметка читалки FB2', () => {
    const html = '<section class="fb2-section"><h3 class="fb2-title">Глава</h3><p>текст</p></section>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('цитата, черта и блок кода', () => {
    const html = '<blockquote><p>цитата</p></blockquote><hr><pre><code>код</code></pre>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('<blockquote>');
    expect(clean).toContain('<hr>');
    expect(clean).toContain('<pre>');
  });
});
