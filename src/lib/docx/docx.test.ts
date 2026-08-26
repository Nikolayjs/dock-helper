// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';

import { readImageSize } from './imageSize';
import { detectWordFormat } from './wordFormat';
import { readDocx } from './readDocx';
import { docxFileName, escapeXml, htmlToDocxBytes } from './writeDocx';

/** Smallest valid PNG: 1×1, transparent. Used wherever a test needs real image bytes. */
const PNG_1PX_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function partOf(docx: Uint8Array, name: string): string {
  const files = unzipSync(docx);
  expect(Object.keys(files)).toContain(name);
  return strFromU8(files[name]);
}

describe('detectWordFormat', () => {
  it('recognises a docx by its ZIP signature', () => {
    expect(detectWordFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe('docx');
  });

  it('recognises a legacy .doc by its OLE2 signature, not by its name', () => {
    const ole2 = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(detectWordFormat(ole2)).toBe('legacy-doc');
  });

  it('returns null for anything else', () => {
    expect(detectWordFormat(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(detectWordFormat(new Uint8Array([]))).toBeNull();
  });
});

describe('readImageSize', () => {
  it('reads PNG dimensions from the IHDR chunk', () => {
    expect(readImageSize(bytesFromBase64(PNG_1PX_BASE64))).toEqual({ width: 1, height: 1 });
  });

  it('reads GIF dimensions from the logical screen descriptor', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x0a, 0x00, 0x14, 0x00]);
    expect(readImageSize(gif)).toEqual({ width: 10, height: 20 });
  });

  it('reads JPEG dimensions from the start-of-frame segment', () => {
    // SOI, an APP0 segment to be skipped, then SOF0 carrying height 0x0040 and width 0x0080.
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x80, 0x03,
    ]);
    expect(readImageSize(jpeg)).toEqual({ width: 128, height: 64 });
  });

  it('returns null rather than guessing on bytes it does not recognise', () => {
    expect(readImageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe('escapeXml', () => {
  it('escapes the five characters that would break the document', () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
  });
});

describe('htmlToDocxBytes', () => {
  it('produces a ZIP holding the parts Word requires', () => {
    const docx = htmlToDocxBytes({ title: 'Тест', html: '<p>Привет</p>' });
    const names = Object.keys(unzipSync(docx));
    expect(names).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'docProps/core.xml',
        'word/document.xml',
        'word/_rels/document.xml.rels',
        'word/styles.xml',
        'word/numbering.xml',
      ]),
    );
  });

  it('writes the title and author into the core properties Word shows in File → Info', () => {
    const docx = htmlToDocxBytes({ title: 'Ведение ХСН', author: 'Иванов И. И.', html: '<p>текст</p>' });
    const core = partOf(docx, 'docProps/core.xml');
    expect(core).toContain('<dc:title>Ведение ХСН</dc:title>');
    expect(core).toContain('<dc:creator>Иванов И. И.</dc:creator>');
  });

  it('maps headings onto Word heading styles so the navigation pane works', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<h2>Раздел</h2><h3>Подраздел</h3>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:pStyle w:val="Heading2"/>');
    expect(document).toContain('<w:pStyle w:val="Heading3"/>');
  });

  it('carries the four marks through as run properties', () => {
    const docx = htmlToDocxBytes({
      title: 't',
      html: '<p><strong>ж</strong><em>к</em><u>п</u><s>з</s></p>',
    });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:b/>');
    expect(document).toContain('<w:i/>');
    expect(document).toContain('<w:u w:val="single"/>');
    expect(document).toContain('<w:strike/>');
  });

  it('gives each top-level list its own numId so a second list restarts at 1', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<ol><li>а</li></ol><p>между</p><ol><li>б</li></ol>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:numId w:val="1"/>');
    expect(document).toContain('<w:numId w:val="2"/>');
    // Both instances must be declared, or Word shows the items unnumbered.
    const numbering = partOf(docx, 'word/numbering.xml');
    expect(numbering).toContain('<w:num w:numId="1">');
    expect(numbering).toContain('<w:num w:numId="2">');
  });

  it('nests a sublist one indent level deeper', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<ul><li><p>верх</p><ul><li>низ</li></ul></li></ul>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:ilvl w:val="0"/>');
    expect(document).toContain('<w:ilvl w:val="1"/>');
  });

  it('embeds a data-URL image as a real picture part sized from its own bytes', () => {
    const docx = htmlToDocxBytes({
      title: 't',
      html: `<p><img src="data:image/png;base64,${PNG_1PX_BASE64}"></p>`,
    });
    const files = unzipSync(docx);
    expect(Object.keys(files)).toContain('word/media/image1.png');
    // 1 px at 9525 EMU per px.
    expect(strFromU8(files['word/document.xml'])).toContain('<wp:extent cx="9525" cy="9525"/>');
    expect(strFromU8(files['[Content_Types].xml'])).toContain('<Default Extension="png" ContentType="image/png"/>');
  });

  it('records a hyperlink as an external relationship', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<p><a href="https://example.org">сюда</a></p>' });
    expect(partOf(docx, 'word/_rels/document.xml.rels')).toContain('TargetMode="External"');
    expect(partOf(docx, 'word/document.xml')).toContain('<w:hyperlink r:id=');
  });

  it('gives every table cell a paragraph — Word rejects a cell without one', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<table><tr><td>a</td><td></td></tr></table>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:tbl>');

    const cells = document.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
    expect(cells).toHaveLength(2);
    cells.forEach((cell) => expect(cell).toMatch(/<w:p[ />]/));
  });

  it('splits a code block so each line survives as its own paragraph', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<pre><code>один\nдва</code></pre>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document.match(/HTMLPreformatted/g)).toHaveLength(2);
  });

  it('escapes text that would otherwise close a tag', () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<p>5 &lt; 7 &amp; 8 &gt; 6</p>' });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('5 &lt; 7 &amp; 8 &gt; 6');
  });
});

describe('docxFileName', () => {
  it('keeps the title but drops characters a filesystem refuses', () => {
    expect(docxFileName('Гипертония: ведение / 2026')).toBe('Гипертония ведение 2026.docx');
  });

  it('falls back when the title is blank', () => {
    expect(docxFileName('   ')).toBe('Документ.docx');
  });
});

describe('round trip', () => {
  /**
   * The point of the pair: a document this application writes must be one it can read back. This
   * catches a malformed part that Word would silently repair but our own importer would not.
   */
  it('reads back what it wrote — headings, marks, lists, links and pictures', async () => {
    const html =
      '<h2>Заголовок</h2>' +
      '<p>Обычный текст со <strong>жирным</strong> и <em>курсивом</em>.</p>' +
      '<ul><li>первый</li><li>второй</li></ul>' +
      '<p><a href="https://example.org">ссылка</a></p>' +
      `<p><img src="data:image/png;base64,${PNG_1PX_BASE64}"></p>`;

    const docx = htmlToDocxBytes({ title: 'Круговой тест', author: 'Автор', html });
    const back = await readDocx(docx);

    expect(back.title).toBe('Круговой тест');
    expect(back.author).toBe('Автор');
    expect(back.html).toContain('<h2>Заголовок</h2>');
    expect(back.html).toContain('<strong>жирным</strong>');
    expect(back.html).toContain('<em>курсивом</em>');
    expect(back.html).toContain('<li>первый</li>');
    expect(back.html).toContain('href="https://example.org"');
    expect(back.coverDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('refuses a legacy .doc with an instruction instead of a parser crash', async () => {
    const ole2 = new Uint8Array(64);
    ole2.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(readDocx(ole2)).rejects.toThrow(/Сохранить как/);
  });

  it('drops a javascript: link rather than carrying it into the reader', async () => {
    const docx = htmlToDocxBytes({ title: 't', html: '<p><a href="javascript:alert(1)">клик</a></p>' });
    const back = await readDocx(docx);
    expect(back.html).not.toContain('javascript:');
    expect(back.html).toContain('клик');
  });
});

describe('table header rows', () => {
  it('marks a <th> row so Word repeats it after a page break', () => {
    const docx = htmlToDocxBytes({
      title: 't',
      html: '<table><tr><th>Группа</th></tr><tr><td>18–64</td></tr></table>',
    });
    const document = partOf(docx, 'word/document.xml');
    expect(document).toContain('<w:trPr><w:tblHeader/></w:trPr>');
    // Only the header row carries it.
    expect(document.match(/<w:tblHeader\/>/g)).toHaveLength(1);
  });
});

describe('import warnings', () => {
  it('stays silent about Word bookkeeping elements it drops', async () => {
    // Word writes w:tblPrEx into practically every table; mammoth reports dropping it. Surfacing
    // that would put a warning on every real document.
    const docx = htmlToDocxBytes({ title: 't', html: '<table><tr><td>a</td></tr></table>' });
    const back = await readDocx(docx);
    expect(back.warnings.filter((w) => w.includes('w:tblPrEx'))).toHaveLength(0);
  });
});
