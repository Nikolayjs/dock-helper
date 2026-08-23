/**
 * Minimal FB2 (FictionBook 2) reader: pulls out title/author/annotation/cover
 * metadata, and converts the `<body>` into simplified HTML for the reader view.
 * Covers the tags that show up in the vast majority of real-world FB2 files;
 * anything unrecognized just falls through to its rendered children.
 */

export interface Fb2Content {
  title: string;
  author: string;
  description: string;
  coverDataUrl: string | null;
  bodyHtml: string;
}

const INLINE_TAG_MAP: Record<string, string> = {
  emphasis: 'em',
  strong: 'strong',
  strikethrough: 's',
  sub: 'sub',
  sup: 'sup',
  code: 'code',
};

function text(el: Element | null): string {
  return el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function getHref(el: Element): string | null {
  return (
    el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
    el.getAttribute('xlink:href') ||
    el.getAttribute('l:href') ||
    el.getAttribute('href')
  );
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function authorName(authorEl: Element | null): string {
  if (!authorEl) return '';
  const first = text(authorEl.querySelector('first-name'));
  const middle = text(authorEl.querySelector('middle-name'));
  const last = text(authorEl.querySelector('last-name'));
  const nickname = text(authorEl.querySelector('nickname'));
  const fullName = [first, middle, last].filter(Boolean).join(' ');
  return fullName || nickname;
}

function renderInline(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.localName.toLowerCase();
  const inner = Array.from(el.childNodes).map(renderInline).join('');
  const mappedTag = INLINE_TAG_MAP[tag];
  if (mappedTag) return `<${mappedTag}>${inner}</${mappedTag}>`;
  if (tag === 'a') return `<span class="fb2-note">${inner}</span>`;
  return inner;
}

function renderTitle(el: Element, depth: number): string {
  const level = Math.min(depth + 2, 6);
  const lines = Array.from(el.querySelectorAll('p')).map((p) => Array.from(p.childNodes).map(renderInline).join(''));
  return `<h${level} class="fb2-title">${lines.join('<br/>')}</h${level}>`;
}

function renderChildren(el: Element, binaries: Map<string, string>, depth: number): string {
  return Array.from(el.children)
    .map((child) => renderBlock(child, binaries, depth))
    .join('');
}

function renderBlock(el: Element, binaries: Map<string, string>, depth: number): string {
  switch (el.localName.toLowerCase()) {
    case 'p':
      return `<p>${Array.from(el.childNodes).map(renderInline).join('')}</p>`;
    case 'empty-line':
      return '<br/>';
    case 'title':
      return renderTitle(el, depth);
    case 'subtitle':
      return `<h4 class="fb2-subtitle">${Array.from(el.childNodes).map(renderInline).join('')}</h4>`;
    case 'epigraph':
      return `<blockquote class="fb2-epigraph">${renderChildren(el, binaries, depth)}</blockquote>`;
    case 'cite':
      return `<blockquote class="fb2-cite">${renderChildren(el, binaries, depth)}</blockquote>`;
    case 'poem':
      return `<div class="fb2-poem">${renderChildren(el, binaries, depth)}</div>`;
    case 'stanza':
      return `<div class="fb2-stanza">${Array.from(el.querySelectorAll('v'))
        .map((v) => `<div class="fb2-verse">${Array.from(v.childNodes).map(renderInline).join('')}</div>`)
        .join('')}</div>`;
    case 'image': {
      const href = getHref(el);
      const src = href ? binaries.get(href.replace(/^#/, '')) : undefined;
      return src ? `<img class="fb2-image" src="${src}" alt="" />` : '';
    }
    case 'section':
      return `<section class="fb2-section">${renderChildren(el, binaries, depth + 1)}</section>`;
    default:
      return renderChildren(el, binaries, depth);
  }
}

/** FB2 files declare their own encoding (often windows-1251) in the XML prolog. */
function detectXmlEncoding(buffer: ArrayBuffer): string {
  const head = new Uint8Array(buffer.slice(0, 200));
  const ascii = Array.from(head)
    .map((byte) => String.fromCharCode(byte))
    .join('');
  const match = ascii.match(/encoding=["']([\w-]+)["']/i);
  return match ? match[1].toLowerCase() : 'utf-8';
}

export function decodeFb2Text(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder(detectXmlEncoding(buffer)).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

export function parseFb2(xmlText: string): Fb2Content {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Не удалось прочитать файл: повреждённый FB2');
  }

  const binaries = new Map<string, string>();
  doc.querySelectorAll('binary').forEach((bin) => {
    const id = bin.getAttribute('id');
    const contentType = bin.getAttribute('content-type') || 'image/jpeg';
    const base64 = (bin.textContent ?? '').replace(/\s+/g, '');
    if (id && base64) binaries.set(id, `data:${contentType};base64,${base64}`);
  });

  const titleInfo = doc.querySelector('description > title-info') ?? doc.querySelector('title-info');
  const title = text(titleInfo?.querySelector('book-title') ?? null);
  const author = authorName(titleInfo?.querySelector('author') ?? null);

  const annotation = titleInfo?.querySelector('annotation') ?? null;
  const description = annotation
    ? Array.from(annotation.querySelectorAll('p'))
        .map((p) => text(p))
        .filter(Boolean)
        .join('\n\n')
    : '';

  const coverImage = titleInfo?.querySelector('coverpage image') ?? null;
  const coverHref = coverImage ? getHref(coverImage) : null;
  const coverDataUrl = (coverHref && binaries.get(coverHref.replace(/^#/, ''))) || null;

  const bodies = Array.from(doc.querySelectorAll('body'));
  const mainBody = bodies.find((body) => body.getAttribute('name') !== 'notes') ?? bodies[0] ?? null;
  const bodyHtml = mainBody ? renderChildren(mainBody, binaries, 0) : '';

  return { title, author, description, coverDataUrl, bodyHtml };
}
