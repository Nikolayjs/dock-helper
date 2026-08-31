import { useMemo } from 'react';
import DOMPurify from 'dompurify';

/**
 * Единственное место, где чужая разметка попадает на страницу.
 *
 * Чужой она бывает по-разному: заметку и документ пишет врач — но в общем рабочем пространстве их
 * несколько; статью в базу знаний импортируют из чужого Word; книгу FB2 приносят файлом; полный
 * текст новости приезжает с постороннего сайта; бланк подставляет в себя фамилию пациента. Ни один
 * из этих источников не обязан быть безобидным, и до этого ни один не проверялся.
 *
 * Профиль собран **под схему Tiptap** — ровно то, что редактор умеет создавать и что `writeDocx`
 * умеет выгружать, — плюс то, что рисуют читалка FB2 и ссылки `[[Название]]`. Список тегов шире
 * схемы там, где разметка приходит извне: `section`, `figure`, `sub`, `sup`.
 *
 * **`style` разрешён сознательно.** На нём держатся выравнивание абзаца, цвет текста и ширина
 * столбца таблицы; DOMPurify чистит его своим фильтром CSS. Запретить его значило бы потерять
 * оформление каждого документа, набранного до сегодняшнего дня.
 *
 * **`data:` в `src` картинки разрешён** — им живут и снимки из Word (`shrinkImage` кладёт их прямо
 * в документ), и иллюстрации FB2. DOMPurify пропускает `data:` только на теги-носители картинок и
 * только он: `javascript:` и `vbscript:` отсекаются везде.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'div', 'span', 'section', 'blockquote', 'pre', 'code',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'mark', 'sub', 'sup', 'small',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'figure', 'figcaption',
  // Сокращение в описании болезни: расшифровка живёт в `title` и достаётся диктору тоже.
  'abbr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'title',
  'src', 'alt', 'width', 'height',
  'class', 'style', 'align',
  'colspan', 'rowspan', 'colwidth', 'span',
  // Списки задач Tiptap и ссылки `[[Название]]`: по ним рисуются флажок и переход. `data-wiki-link`
  // — тот же признак у ссылок справочника заболеваний, где целью бывает не только документ.
  'data-type', 'data-checked', 'data-doc-link', 'data-wiki-link',
];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Ссылка, открывающаяся в новой вкладке, без `rel` даёт открывшей странице доступ к `opener`.
    ADD_ATTR: ['target'],
    // `<form>` внутри документа врача — это чужая форма отправки на чужой адрес.
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'style', 'script', 'iframe', 'object', 'embed'],
  });
}

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  // Чистка стоит денег на длинном тексте — книга из Word это семнадцать тысяч узлов, — поэтому она
  // не повторяется на каждый рендер: перерисовок у читалки много, а разметка меняется редко.
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
