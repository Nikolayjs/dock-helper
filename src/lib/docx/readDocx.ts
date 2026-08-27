/**
 * Reads a .docx into HTML, plus whatever Word recorded about the document itself.
 *
 * mammoth does the body: it maps Word's styles onto semantic HTML rather than trying to reproduce
 * the paper, which is what both callers want — the library renders it as a reflowable page, and the
 * article editor has to fit it into a Tiptap schema that has no notion of margins or fonts anyway.
 *
 * It is loaded with a dynamic import on purpose. It is the largest dependency in the bundle and is
 * needed only at the moment a Word file is actually opened, which for most sessions is never.
 */
import { inlineImageSource } from './shrinkImage';
import { assertReadableDocx } from './wordFormat';

export interface DocxRead {
  html: string;
  /** From `docProps/core.xml` — empty when Word never recorded one. */
  title: string;
  author: string;
  /** First picture in the document, for the library card. */
  coverDataUrl: string | null;
  /** Anything mammoth could not represent: unmapped styles, dropped elements. */
  warnings: string[];
}

/** `javascript:` and `data:text/html` in a link would run on click; nothing else is dangerous here. */
const SAFE_URL = /^(https?:|mailto:|tel:|ftp:|#|\/|\.\.?\/)/i;

function textOf(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) return '';
  return match[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

type Fflate = typeof import('fflate');

function readCoreProperties(fflate: Fflate, bytes: Uint8Array): { title: string; author: string } {
  try {
    const entry = fflate.unzipSync(bytes, { filter: (file) => file.name === 'docProps/core.xml' })['docProps/core.xml'];
    if (!entry) return { title: '', author: '' };
    const xml = fflate.strFromU8(entry);
    return { title: textOf(xml, 'dc:title'), author: textOf(xml, 'dc:creator') };
  } catch {
    // Metadata is a nicety; a document that cannot produce it still reads fine.
    return { title: '', author: '' };
  }
}

/**
 * Strips link and image targets that would execute. mammoth builds its own elements from OOXML, so
 * tags and text are already safe — a URL is the one value that travels from the file unchanged.
 */
function sanitizeUrls(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href]').forEach((el) => {
    if (!SAFE_URL.test(el.getAttribute('href')?.trim() ?? '')) el.removeAttribute('href');
  });
  doc.querySelectorAll('img[src]').forEach((el) => {
    const src = el.getAttribute('src')?.trim() ?? '';
    if (!src.startsWith('data:image/') && !SAFE_URL.test(src)) el.remove();
  });
  return doc.body.innerHTML;
}

/**
 * Elements Word writes for its own bookkeeping — revision marks, spell-check spans, page-break
 * hints, table-property overrides. mammoth reports dropping each one, but none of them carries
 * content, and a real Word document contains dozens: shown as-is they would put a warning on every
 * single import and teach the doctor to ignore the one that matters.
 *
 * The list grows only when a new element turns out to be noise. Anything not on it is still
 * reported, because a dropped element that *does* carry content is worth knowing about.
 */
const COSMETIC_ELEMENTS = [
  'w:tblPrEx',
  'w:proofErr',
  'w:lastRenderedPageBreak',
  'w:bookmarkStart',
  'w:bookmarkEnd',
  'w:sectPr',
  'w:pPrChange',
  'w:rPrChange',
  'w:tblLook',
  'w:cnfStyle',
  'w:noProof',
  'w:spacing',
  'w:softHyphen',
];

function isNoise(message: string): boolean {
  const ignored = /^An unrecognised element was ignored:\s*(\S+)/.exec(message);
  return ignored != null && COSMETIC_ELEMENTS.includes(ignored[1]);
}

function firstImage(html: string): string | null {
  const match = /<img[^>]+src="(data:image\/[^"]+)"/i.exec(html);
  return match ? match[1] : null;
}

export async function readDocx(bytes: Uint8Array): Promise<DocxRead> {
  assertReadableDocx(bytes);

  // Both are wanted at the same moment and only at that moment, so they load together and stay out
  // of the initial bundle — mammoth alone is the largest dependency in the application.
  const [mammoth, fflate] = await Promise.all([import('mammoth'), import('fflate')]);
  const convert = (mammoth as unknown as { convertToHtml: typeof import('mammoth').convertToHtml }).convertToHtml;

  // A Uint8Array view may be a window onto a larger buffer; hand over exactly this document.
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  const base64ToBytes = (base64: string): Uint8Array => {
    const binary = atob(base64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };

  const result = await convert(
    // mammoth ships two readers and picks one by the bundler's `browser` field: the browser one
    // takes `arrayBuffer`, the Node one takes `buffer`, and both then call the same unzip. Naming
    // both keys means this call works under either without asking which one got loaded — and the
    // tests exercise the same line the browser runs.
    { arrayBuffer, buffer: arrayBuffer } as Parameters<typeof convert>[0],
    {
      styleMap: [
        // Word's own names for these differ per locale and template; map the common Russian ones too.
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Название'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Подзаголовок'] => h2:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Цитата'] => blockquote:fresh",
        'u => u',
        'strike => s',
        // Маркер: без этой строки выделение, поставленное здесь и выгруженное в Word, при обратном
        // чтении пропадало бы молча. Надстрочный и подстрочный индексы mammoth переносит сам.
        'highlight => mark',
      ],
      /**
       * Replaces mammoth's default handler, which inlines every picture at Word's own resolution.
       * See shrinkImage.ts for why that resolution is the wrong one to carry around.
       */
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: await inlineImageSource(base64ToBytes(await image.readAsBase64String()), image.contentType),
        // `altText` is on the object but missing from mammoth's typings.
        alt: (image as { altText?: string }).altText ?? '',
      })),
    },
  );

  const html = sanitizeUrls(result.value);
  const core = readCoreProperties(fflate, bytes);

  return {
    html,
    title: core.title,
    author: core.author,
    coverDataUrl: firstImage(html),
    warnings: result.messages.filter((m) => m.type === 'warning' && !isNoise(m.message)).map((m) => m.message),
  };
}

export async function readDocxFile(file: File): Promise<DocxRead> {
  return readDocx(new Uint8Array(await file.arrayBuffer()));
}
