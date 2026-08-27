/**
 * Turns the editor's HTML into a .docx file.
 *
 * Written by hand rather than pulled from a library because the input is not arbitrary HTML: it is
 * whatever the Tiptap schema in DocumentForm can produce, which is a closed list — headings, the
 * four marks, links, lists, quotes, code, images, tables. A converter for a schema we own is a few
 * hundred lines and fails visibly; a general HTML→Word library is a megabyte and fails on the parts
 * of HTML we never emit.
 *
 * The output is real WordprocessingML, not the `altChunk` trick of embedding HTML inside a .docx
 * shell. altChunk renders in Word and nowhere else — not in LibreOffice, not in Google Docs, and
 * notably not in our own importer, so a document exported and re-imported would come back empty.
 */
import { zipSync, strToU8 } from 'fflate';

import { readImageSize } from './imageSize';

export interface DocxInput {
  title: string;
  author?: string;
  /** HTML from the editor — see the schema note above. */
  html: string;
}

/** English Metric Units, the unit Word measures pictures in: 914400 per inch, 96 CSS px per inch. */
const EMU_PER_PX = 9525;
/** A4 minus 2 cm margins, in EMU — the widest a picture may be before Word pushes it off the page. */
const CONTENT_WIDTH_EMU = 6120000;

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Formatting carried down the inline tree; a run is emitted with whatever is switched on here. */
interface Marks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  /** 'superscript' | 'subscript' — Word's own two values for w:vertAlign. */
  vertAlign?: 'superscript' | 'subscript';
  /** RRGGBB without the hash, the only form w:color takes. */
  color?: string;
  /** One of Word's named highlight colours; see HIGHLIGHT_TO_WORD. */
  highlight?: string;
  /** Half-points, the unit w:sz measures in. */
  halfPoints?: number;
  fontFamily?: string;
  /** Relationship id of the enclosing hyperlink, if any. */
  linkRel?: string;
}

/**
 * Цвет маркера переводится в **именованный** цвет Word, а не в произвольный.
 *
 * `w:highlight` принимает только свой список названий — это настоящий маркер, который видно и в
 * режиме правки, и на печати. Произвольный цвет пришлось бы отдавать заливкой `w:shd`, а она в Word
 * ведёт себя как фон абзаца, а не как выделение. Поэтому палитра в редакторе ровно из тех цветов,
 * для которых у Word есть имя.
 */
const HIGHLIGHT_TO_WORD: Record<string, string> = {
  '#ffec99': 'yellow',
  '#b2f2bb': 'green',
  '#99e9f2': 'cyan',
  '#ffc9c9': 'red',
  '#eebefa': 'magenta',
  '#a5d8ff': 'blue',
};

export function wordHighlight(color: string): string {
  return HIGHLIGHT_TO_WORD[color.trim().toLowerCase()] ?? 'yellow';
}

/** `#1a2b3c` или `rgb(26, 43, 60)` → `1A2B3C`; всё непонятое отбрасывается, а не пишется наугад. */
export function hexColor(raw: string): string | undefined {
  const value = raw.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(value);
  if (hex) return hex[1].toUpperCase();
  const short = /^#([0-9a-f]{3})$/.exec(value);
  if (short) return short[1].split('').map((c) => c + c).join('').toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

/**
 * Размер шрифта в половинах пункта — единица, в которой его хранит Word.
 *
 * Редактор пишет `pt`, вставка из другого редактора может принести `px`; 96 пикселей на дюйм против
 * 72 пунктов дают коэффициент 0,75.
 */
export function halfPointsFrom(raw: string): number | undefined {
  const value = raw.trim().toLowerCase();
  const points = /^([\d.]+)pt$/.exec(value);
  if (points) return Math.round(Number(points[1]) * 2);
  const pixels = /^([\d.]+)px$/.exec(value);
  if (pixels) return Math.round(Number(pixels[1]) * 0.75 * 2);
  return undefined;
}

interface MediaPart {
  name: string;
  bytes: Uint8Array;
}

interface Relationship {
  id: string;
  type: string;
  target: string;
  external?: boolean;
}

const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

class DocxBuilder {
  readonly body: string[] = [];
  readonly media: MediaPart[] = [];
  readonly rels: Relationship[] = [];
  /** One `w:num` per top-level list, so a second list restarts at 1 instead of continuing the first. */
  readonly listInstances: { numId: number; ordered: boolean }[] = [];
  private nextRelId = 1;
  private nextDocPrId = 1;

  addRel(type: string, target: string, external = false): string {
    const id = `rId${this.nextRelId++}`;
    this.rels.push({ id, type, target, external });
    return id;
  }

  addImage(bytes: Uint8Array, extension: string): string {
    const name = `image${this.media.length + 1}.${extension}`;
    this.media.push({ name, bytes });
    return this.addRel(`${REL_BASE}/image`, `media/${name}`);
  }

  newListInstance(ordered: boolean): number {
    const numId = this.listInstances.length + 1;
    this.listInstances.push({ numId, ordered });
    return numId;
  }

  nextPictureId(): number {
    return this.nextDocPrId++;
  }
}

/** Where a paragraph sits: its Word style, its list membership, its alignment. */
interface ParagraphContext {
  style?: string;
  numId?: number;
  level?: number;
  align?: string;
}

function alignmentOf(el: Element): string | undefined {
  // TextAlign writes an inline style; that is the only place alignment can come from here.
  const raw = (el as HTMLElement).style?.textAlign || '';
  if (raw === 'center') return 'center';
  if (raw === 'right') return 'right';
  if (raw === 'justify') return 'both';
  return undefined;
}

function paragraphProps(context: ParagraphContext): string {
  const parts: string[] = [];
  if (context.style) parts.push(`<w:pStyle w:val="${context.style}"/>`);
  if (context.numId != null) {
    parts.push(`<w:numPr><w:ilvl w:val="${context.level ?? 0}"/><w:numId w:val="${context.numId}"/></w:numPr>`);
  }
  if (context.align) parts.push(`<w:jc w:val="${context.align}"/>`);
  return parts.length ? `<w:pPr>${parts.join('')}</w:pPr>` : '';
}

function runProps(marks: Marks): string {
  const parts: string[] = [];
  if (marks.linkRel) parts.push('<w:rStyle w:val="Hyperlink"/>');
  if (marks.code) parts.push('<w:rStyle w:val="HTMLCode"/>');
  // Порядок элементов в w:rPr задан схемой, а не вкусом: rFonts, b, i, strike, color, sz,
  // highlight, u, vertAlign. Word открывает файл и с нарушенным порядком, но валидатор ругается,
  // а LibreOffice часть свойств теряет.
  if (marks.fontFamily) {
    const font = escapeXml(marks.fontFamily);
    parts.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`);
  }
  if (marks.bold) parts.push('<w:b/>');
  if (marks.italic) parts.push('<w:i/>');
  if (marks.strike) parts.push('<w:strike/>');
  if (marks.color) parts.push(`<w:color w:val="${marks.color}"/>`);
  if (marks.halfPoints) parts.push(`<w:sz w:val="${marks.halfPoints}"/><w:szCs w:val="${marks.halfPoints}"/>`);
  if (marks.highlight) parts.push(`<w:highlight w:val="${marks.highlight}"/>`);
  if (marks.underline) parts.push('<w:u w:val="single"/>');
  if (marks.vertAlign) parts.push(`<w:vertAlign w:val="${marks.vertAlign}"/>`);
  return parts.length ? `<w:rPr>${parts.join('')}</w:rPr>` : '';
}

function textRun(text: string, marks: Marks): string {
  return `<w:r>${runProps(marks)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function decodeDataUrl(src: string): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(src);
  if (!match) return null;
  const extension = MIME_EXTENSION[match[1].toLowerCase()];
  if (!extension) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { bytes, extension };
  } catch {
    return null;
  }
}

function drawingRun(builder: DocxBuilder, el: Element): string {
  const src = el.getAttribute('src') ?? '';
  const decoded = decodeDataUrl(src);
  // A remote image cannot be fetched without making the whole export async, and this editor stores
  // pasted and inserted pictures as data URLs anyway. Anything else degrades to its alt text.
  if (!decoded) {
    const alt = el.getAttribute('alt');
    return alt ? textRun(alt, {}) : '';
  }

  const size = readImageSize(decoded.bytes) ?? { width: 600, height: 400 };
  // Ширина, заданная врачом в редакторе, важнее натуральной: он её и видел, когда писал документ.
  // Высота считается по ней, а не берётся своя, — иначе снимок уехал бы в другие пропорции.
  const chosen = Number.parseInt(el.getAttribute('width') ?? '', 10);
  const width = Number.isFinite(chosen) && chosen > 0 ? chosen : size.width;
  const height = size.width > 0 ? Math.round((size.height * width) / size.width) : size.height;

  let widthEmu = width * EMU_PER_PX;
  let heightEmu = height * EMU_PER_PX;
  if (widthEmu > CONTENT_WIDTH_EMU) {
    heightEmu = Math.round((heightEmu * CONTENT_WIDTH_EMU) / widthEmu);
    widthEmu = CONTENT_WIDTH_EMU;
  }

  const relId = builder.addImage(decoded.bytes, decoded.extension);
  const id = builder.nextPictureId();
  const name = `Picture ${id}`;

  return (
    '<w:r><w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:docPr id="${id}" name="${escapeXml(name)}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${escapeXml(name)}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
    `<a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline>' +
    '</w:drawing></w:r>'
  );
}

/** Collects the runs of one paragraph by walking its inline descendants. */
function collectRuns(builder: DocxBuilder, node: Node, marks: Marks, out: string[]): void {
  if (node.nodeType === 3) {
    const text = node.nodeValue ?? '';
    if (text) out.push(textRun(text, marks));
    return;
  }
  if (node.nodeType !== 1) return;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    out.push('<w:r><w:br/></w:r>');
    return;
  }
  if (tag === 'img') {
    const run = drawingRun(builder, el);
    if (run) out.push(run);
    return;
  }

  const next: Marks = { ...marks };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u' || tag === 'ins') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  if (tag === 'code') next.code = true;
  if (tag === 'sup') next.vertAlign = 'superscript';
  if (tag === 'sub') next.vertAlign = 'subscript';
  if (tag === 'mark') {
    next.highlight = wordHighlight(el.getAttribute('data-color') ?? (el as HTMLElement).style?.backgroundColor ?? '');
  }

  // Цвет, кегль и гарнитуру Tiptap пишет инлайновым стилем на <span>; они наследуются вложенными
  // элементами, поэтому собираются в те же марки, а не обрабатываются отдельной веткой.
  const style = (el as HTMLElement).style;
  if (style?.color) next.color = hexColor(style.color) ?? next.color;
  if (style?.fontSize) next.halfPoints = halfPointsFrom(style.fontSize) ?? next.halfPoints;
  if (style?.fontFamily) next.fontFamily = style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || next.fontFamily;

  if (tag === 'a') {
    const href = el.getAttribute('href');
    if (href) {
      const relId = builder.addRel(`${REL_BASE}/hyperlink`, href, true);
      const inner: string[] = [];
      el.childNodes.forEach((child) => collectRuns(builder, child, { ...next, linkRel: relId }, inner));
      out.push(`<w:hyperlink r:id="${relId}">${inner.join('')}</w:hyperlink>`);
      return;
    }
  }

  el.childNodes.forEach((child) => collectRuns(builder, child, next, out));
}

function emitParagraph(builder: DocxBuilder, el: Element, context: ParagraphContext): void {
  const runs: string[] = [];
  el.childNodes.forEach((child) => collectRuns(builder, child, {}, runs));
  // An empty paragraph is meaningful — it is the blank line the doctor typed.
  builder.body.push(`<w:p>${paragraphProps({ ...context, align: context.align ?? alignmentOf(el) })}${runs.join('')}</w:p>`);
}

const HEADING_STYLE: Record<string, string> = {
  h1: 'Heading1',
  h2: 'Heading2',
  h3: 'Heading3',
  h4: 'Heading4',
  h5: 'Heading5',
  h6: 'Heading6',
};

/**
 * Список задач уходит в Word обычным списком, у которого перед текстом стоит символ флажка.
 *
 * Настоящего флажка в `.docx` нет — есть поле формы, которое ведёт себя как элемент управления и в
 * половине просмотрщиков не рисуется вовсе. Символ виден везде и печатается: на бумаге галочка
 * важнее того, можно ли по ней щёлкнуть.
 */
function emitTaskList(builder: DocxBuilder, el: Element): void {
  Array.from(el.children).forEach((item) => {
    if (item.tagName.toLowerCase() !== 'li') return;
    const checked = item.getAttribute('data-checked') === 'true';
    const runs: string[] = [textRun(checked ? '☑ ' : '☐ ', {})];
    // Tiptap заворачивает текст пункта в <div><p>…</p></div> рядом с <label>; берётся только он.
    const body = item.querySelector('div');
    (body ?? item).childNodes.forEach((child) => {
      if ((child as Element).tagName?.toLowerCase() === 'label') return;
      collectRuns(builder, child, {}, runs);
    });
    builder.body.push(`<w:p>${runs.join('')}</w:p>`);
  });
}

function emitList(builder: DocxBuilder, el: Element, ordered: boolean, level: number, numId?: number): void {
  const listId = numId ?? builder.newListInstance(ordered);
  Array.from(el.children).forEach((li) => {
    if (li.tagName.toLowerCase() !== 'li') return;

    // A list item is `<li><p>text</p><ul>…</ul></li>` in Tiptap and bare text in pasted HTML.
    const nested = Array.from(li.children).filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase()));
    const direct = Array.from(li.childNodes).filter((child) => !nested.includes(child as Element));

    const blocks = direct.filter((child) => child.nodeType === 1 && ['p', 'div'].includes((child as Element).tagName.toLowerCase()));
    if (blocks.length > 0) {
      blocks.forEach((block) => emitParagraph(builder, block as Element, { style: 'ListParagraph', numId: listId, level }));
    } else {
      const runs: string[] = [];
      direct.forEach((child) => collectRuns(builder, child, {}, runs));
      builder.body.push(`<w:p>${paragraphProps({ style: 'ListParagraph', numId: listId, level })}${runs.join('')}</w:p>`);
    }

    nested.forEach((child) => {
      const childOrdered = child.tagName.toLowerCase() === 'ol';
      // Depth beyond nine has no level defined in numbering.xml; clamp rather than emit a bad ilvl.
      emitList(builder, child, childOrdered, Math.min(level + 1, 8), childOrdered === ordered ? listId : undefined);
    });
  });
}

function emitTable(builder: DocxBuilder, el: Element): void {
  const rows = Array.from(el.querySelectorAll('tr'));
  if (rows.length === 0) return;

  const xml: string[] = [
    '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/>' +
      '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
        .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
        .join('') +
      '</w:tblBorders></w:tblPr>',
  ];

  rows.forEach((row) => {
    // A row of <th> becomes Word's repeating header row, so a table that spans a page break still
    // shows what its columns mean on the second page.
    const isHeader = Array.from(row.children).some((cell) => cell.tagName.toLowerCase() === 'th');
    xml.push(isHeader ? '<w:tr><w:trPr><w:tblHeader/></w:trPr>' : '<w:tr>');
    Array.from(row.children).forEach((cell) => {
      const tag = cell.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') return;
      const span = Number(cell.getAttribute('colspan') ?? '1');
      const cellProps =
        '<w:tcPr><w:tcW w:w="0" w:type="auto"/>' + (span > 1 ? `<w:gridSpan w:val="${span}"/>` : '') + '</w:tcPr>';

      // Word rejects a table cell with no paragraph in it, so an empty cell still gets one.
      const before = builder.body.length;
      const blocks = Array.from(cell.children).filter((child) =>
        ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol'].includes(child.tagName.toLowerCase()),
      );
      if (blocks.length > 0) {
        blocks.forEach((block) => emitBlock(builder, block));
      } else {
        const runs: string[] = [];
        cell.childNodes.forEach((child) => collectRuns(builder, child, tag === 'th' ? { bold: true } : {}, runs));
        builder.body.push(`<w:p>${runs.join('')}</w:p>`);
      }
      const produced = builder.body.splice(before);
      xml.push(`<w:tc>${cellProps}${produced.length ? produced.join('') : '<w:p/>'}</w:tc>`);
    });
    xml.push('</w:tr>');
  });

  xml.push('</w:tbl>');
  // Word merges two adjacent tables into one; a paragraph between them keeps them apart.
  xml.push('<w:p/>');
  builder.body.push(xml.join(''));
}

function emitBlock(builder: DocxBuilder, el: Element): void {
  const tag = el.tagName.toLowerCase();

  if (HEADING_STYLE[tag]) {
    emitParagraph(builder, el, { style: HEADING_STYLE[tag] });
    return;
  }
  if (tag === 'p') {
    emitParagraph(builder, el, {});
    return;
  }
  if (tag === 'ul' && el.getAttribute('data-type') === 'taskList') {
    emitTaskList(builder, el);
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    emitList(builder, el, tag === 'ol', 0);
    return;
  }
  if (tag === 'blockquote') {
    Array.from(el.children).forEach((child) => {
      if (child.tagName.toLowerCase() === 'p') emitParagraph(builder, child, { style: 'Quote' });
      else emitBlock(builder, child);
    });
    if (el.children.length === 0) emitParagraph(builder, el, { style: 'Quote' });
    return;
  }
  if (tag === 'pre') {
    // Every line of a code block is its own Word paragraph; a newline inside one would be dropped.
    const lines = (el.textContent ?? '').split('\n');
    lines.forEach((line) => {
      builder.body.push(
        `<w:p>${paragraphProps({ style: 'HTMLPreformatted' })}${line ? textRun(line, {}) : ''}</w:p>`,
      );
    });
    return;
  }
  if (tag === 'table') {
    emitTable(builder, el);
    return;
  }
  if (tag === 'hr') {
    builder.body.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>');
    return;
  }
  if (el.hasAttribute('data-page-break')) {
    // Настоящий разрыв страницы Word, а не пустые абзацы до конца листа: строки, набранные после
    // него, начнутся с новой страницы при любом размере шрифта и любых полях.
    builder.body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    return;
  }
  if (tag === 'img') {
    const run = drawingRun(builder, el);
    // Выравнивание картинки — это выравнивание абзаца, в котором она стоит: другого способа
    // подвинуть её к середине листа в Word нет.
    const align = el.getAttribute('data-align');
    const properties = align === 'center' || align === 'right' ? `<w:pPr><w:jc w:val="${align}"/></w:pPr>` : '';
    builder.body.push(`<w:p>${properties}${run}</w:p>`);
    return;
  }
  if (tag === 'br') {
    builder.body.push('<w:p/>');
    return;
  }

  // div, figure, section and anything else structural: descend, but keep loose text in a paragraph.
  const hasBlockChild = Array.from(el.children).some((child) =>
    ['p', 'div', 'ul', 'ol', 'table', 'blockquote', 'pre', 'figure', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(
      child.tagName.toLowerCase(),
    ),
  );
  if (hasBlockChild) {
    Array.from(el.children).forEach((child) => emitBlock(builder, child));
  } else {
    emitParagraph(builder, el, {});
  }
}

function parseBody(html: string): Element {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  return doc.body;
}

function documentXml(builder: DocxBuilder): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    '<w:body>' +
    builder.body.join('') +
    // A4 with 2 cm margins — the paper this application prints on everywhere else.
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>'
  );
}

function relsXml(builder: DocxBuilder): string {
  const entries = builder.rels
    .map(
      (rel) =>
        `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${escapeXml(rel.target)}"` +
        (rel.external ? ' TargetMode="External"' : '') +
        '/>',
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    `<Relationship Id="rIdStyles" Type="${REL_BASE}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rIdNumbering" Type="${REL_BASE}/numbering" Target="numbering.xml"/>` +
    entries +
    '</Relationships>'
  );
}

function numberingXml(builder: DocxBuilder): string {
  const level = (index: number, ordered: boolean) => {
    const indent = 720 * (index + 1);
    return ordered
      ? `<w:lvl w:ilvl="${index}"><w:start w:val="1"/><w:numFmt w:val="decimal"/>` +
          `<w:lvlText w:val="%${index + 1}."/><w:lvlJc w:val="left"/>` +
          `<w:pPr><w:ind w:left="${indent}" w:hanging="360"/></w:pPr></w:lvl>`
      : `<w:lvl w:ilvl="${index}"><w:start w:val="1"/><w:numFmt w:val="bullet"/>` +
          '<w:lvlText w:val="&#9679;"/><w:lvlJc w:val="left"/>' +
          `<w:pPr><w:ind w:left="${indent}" w:hanging="360"/></w:pPr>` +
          '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl>';
  };

  const abstract = (id: number, ordered: boolean) =>
    `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>` +
    Array.from({ length: 9 }, (_, index) => level(index, ordered)).join('') +
    '</w:abstractNum>';

  const instances = builder.listInstances
    .map((list) => `<w:num w:numId="${list.numId}"><w:abstractNumId w:val="${list.ordered ? 1 : 0}"/></w:num>`)
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    abstract(0, false) +
    abstract(1, true) +
    instances +
    '</w:numbering>'
  );
}

const HEADING_SIZES = [32, 28, 24, 22, 20, 20];

function stylesXml(): string {
  const headings = HEADING_SIZES.map((halfPoints, index) => {
    const level = index + 1;
    return (
      `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/>` +
      '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
      `<w:pPr><w:keepNext/><w:spacing w:before="${level <= 2 ? 240 : 200}" w:after="120"/>` +
      `<w:outlineLvl w:val="${index}"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/></w:rPr></w:style>`
    );
  }).join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/>' +
    '</w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    headings +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/>' +
    '<w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:contextualSpacing/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/>' +
    '<w:pPr><w:ind w:left="720"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="BBBBBB"/></w:pBdr></w:pPr>' +
    '<w:rPr><w:i/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="HTMLPreformatted"><w:name w:val="HTML Preformatted"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr>' +
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>' +
    '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
    '<w:style w:type="character" w:styleId="HTMLCode"><w:name w:val="HTML Code"/>' +
    '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>' +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/>' +
    '<w:tblPr><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`)
      .join('') +
    '</w:tblBorders></w:tblPr></w:style>' +
    '</w:styles>'
  );
}

function contentTypesXml(builder: DocxBuilder): string {
  const extensions = new Set(builder.media.map((part) => part.name.split('.').pop() as string));
  const defaults = Array.from(extensions)
    .map((ext) => {
      const mime = ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
      return `<Default Extension="${ext}" ContentType="${mime}"/>`;
    })
    .join('');

  const wordml = 'application/vnd.openxmlformats-officedocument.wordprocessingml';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    defaults +
    `<Override PartName="/word/document.xml" ContentType="${wordml}.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="${wordml}.styles+xml"/>` +
    `<Override PartName="/word/numbering.xml" ContentType="${wordml}.numbering+xml"/>` +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>'
  );
}

function corePropsXml(input: DocxInput): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(input.title)}</dc:title>` +
    `<dc:creator>${escapeXml(input.author ?? '')}</dc:creator>` +
    `<cp:lastModifiedBy>${escapeXml(input.author ?? '')}</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

/** The whole conversion, as bytes — the form the tests exercise. */
export function htmlToDocxBytes(input: DocxInput): Uint8Array {
  const builder = new DocxBuilder();
  const body = parseBody(input.html);

  Array.from(body.children).forEach((child) => emitBlock(builder, child));
  // Content with no block wrapper at all still deserves a paragraph rather than an empty document.
  if (builder.body.length === 0) {
    const runs: string[] = [];
    body.childNodes.forEach((child) => collectRuns(builder, child, {}, runs));
    builder.body.push(`<w:p>${runs.join('')}</w:p>`);
  }

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesXml(builder)),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${REL_BASE}/officeDocument" Target="word/document.xml"/>` +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '</Relationships>',
    ),
    'docProps/core.xml': strToU8(corePropsXml(input)),
    'word/document.xml': strToU8(documentXml(builder)),
    'word/_rels/document.xml.rels': strToU8(relsXml(builder)),
    'word/styles.xml': strToU8(stylesXml()),
    'word/numbering.xml': strToU8(numberingXml(builder)),
  };
  builder.media.forEach((part) => {
    files[`word/media/${part.name}`] = part.bytes;
  });

  return zipSync(files, { level: 6 });
}

export function htmlToDocxBlob(input: DocxInput): Blob {
  const bytes = htmlToDocxBytes(input);
  return new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/** Filesystem-safe name for the download, derived from the document's own title. */
export function docxFileName(title: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${base || 'Документ'}.docx`;
}
