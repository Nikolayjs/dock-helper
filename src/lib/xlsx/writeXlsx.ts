/**
 * Собирает таблицу в файл .xlsx.
 *
 * Написано руками, а не взято библиотекой, по той же причине, что и `writeDocx`: на входе не
 * произвольная книга Excel, а ровно то, что умеет редактор таблиц — один лист, строка заголовков и
 * строки текстовых ячеек. Конвертер под свою схему — двести строк и падает заметно; универсальный
 * писатель XLSX весит сотни килобайт и умеет формулы, сводные таблицы и стили, которых мы никогда
 * не отдадим.
 *
 * Выход — настоящий SpreadsheetML: файл открывается в Excel, LibreOffice, Google Sheets и **нашим
 * собственным импортёром** (`read-excel-file`), на чём и держится круговой тест.
 */
import { zipSync, strToU8 } from 'fflate';

export interface XlsxInput {
  /** Имя листа; берётся из названия документа и приводится к тому, что разрешает Excel. */
  sheetName: string;
  columns: string[];
  rows: string[][];
}

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

/**
 * Символы, запрещённые в XML 1.0: управляющие, кроме табуляции, перевода строки и возврата каретки.
 * Excel такой файл не чинит, а отказывается открывать, поэтому чистим на входе, а не надеемся.
 * Попасть они могут из буфера обмена — например при копировании из PDF.
 */
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(value: string): string {
  return value
    .replace(ILLEGAL_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** A, B, … Z, AA, AB — та же система, что в адресах ячеек Excel. */
export function columnLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Числом ячейка становится, только если это простое целое или десятичная дробь с точкой, не длиннее
 * девяти знаков в целой части и без ведущего нуля.
 *
 * Правило нарочно осторожное. Ячейки, целиком похожие на числа, писать текстом нельзя: Excel
 * пометит каждую зелёным уголком «число сохранено как текст» и откажется их складывать, а колонка
 * «количество» в реестре для того и нужна, чтобы её сложить. Но и обратная ошибка дороже:
 * `89123456789` — это телефон, а числом он превратится в `8,91235E+10`; `007` — это номер, и
 * ведущий ноль пропадёт. Отсюда потолок в девять знаков (телефон длиннее) и запрет ведущего нуля.
 *
 * Даты остаются текстом сознательно: `12.09` — это и дата, и десятичная дробь, и угадывать здесь
 * нечего. Текст сохраняет ровно то, что врач напечатал.
 */
export function numericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?(0|[1-9]\d{0,8})(\.\d{1,6})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function cellXml(reference: string, value: string, header: boolean): string {
  const style = header ? ' s="1"' : '';
  if (!value) return `<c r="${reference}"${style}/>`;

  const number = header ? null : numericValue(value);
  if (number !== null) return `<c r="${reference}"${style}><v>${number}</v></c>`;

  // xml:space="preserve" — иначе разборщик съест ведущие и хвостовые пробелы, а в ячейке
  // «  до уточнения» отступ может быть намеренным.
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function rowXml(cells: string[], rowNumber: number, header: boolean): string {
  const body = cells.map((value, index) => cellXml(`${columnLetter(index)}${rowNumber}`, value, header)).join('');
  return `<row r="${rowNumber}">${body}</row>`;
}

/**
 * Ширина по самой длинной ячейке столбца, в разумных пределах: узкий столбец режет текст, широкий
 * выталкивает соседей за экран.
 */
function columnWidths(input: XlsxInput): number[] {
  return input.columns.map((column, index) => {
    const longest = input.rows.reduce((max, row) => Math.max(max, (row[index] ?? '').length), column.length);
    return Math.min(60, Math.max(8, longest + 2));
  });
}

function sheetXml(input: XlsxInput): string {
  const widths = columnWidths(input);
  const cols = widths.length
    ? `<cols>${widths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const rows = [rowXml(input.columns, 1, true), ...input.rows.map((row, index) => rowXml(row, index + 2, false))].join('');

  // Заголовок закреплён: реестр на двести строк без этого листается вслепую.
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<worksheet xmlns="${MAIN_NS}">` +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    cols +
    `<sheetData>${rows}</sheetData>` +
    '</worksheet>'
  );
}

/**
 * Имя листа по правилам Excel: не длиннее 31 символа, без `: \ / ? * [ ]`, не пустое.
 * Нарушение любого из них Excel считает повреждением файла, а не мелочью.
 */
export function sheetNameFrom(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || 'Лист1';
}

/**
 * Минимальная таблица стилей: обычное начертание и полужирное для строки заголовков.
 *
 * Две заливки — не украшение: Excel требует, чтобы нулевая была `none`, а первая — `gray125`, и
 * файл с одной открывается через диалог восстановления.
 */
function stylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<styleSheet xmlns="${MAIN_NS}">` +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

function workbookXml(sheetName: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_BASE}">` +
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  );
}

function corePropsXml(title: string): string {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${escapeXml(title)}</dc:title>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    '</cp:coreProperties>'
  );
}

function contentTypesXml(): string {
  const spreadsheet = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${spreadsheet}.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${spreadsheet}.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${spreadsheet}.styles+xml"/>` +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '</Types>'
  );
}

/** Вся сборка, как байты — форма, которую проверяют тесты. */
export function sheetToXlsxBytes(input: XlsxInput): Uint8Array {
  const sheetName = sheetNameFrom(input.sheetName);

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesXml()),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${PKG_RELS_NS}">` +
        `<Relationship Id="rId1" Type="${REL_BASE}/officeDocument" Target="xl/workbook.xml"/>` +
        `<Relationship Id="rId2" Type="${PKG_RELS_NS}/metadata/core-properties" Target="docProps/core.xml"/>` +
        '</Relationships>',
    ),
    'docProps/core.xml': strToU8(corePropsXml(input.sheetName)),
    'xl/workbook.xml': strToU8(workbookXml(sheetName)),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Relationships xmlns="${PKG_RELS_NS}">` +
        `<Relationship Id="rId1" Type="${REL_BASE}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${REL_BASE}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(input)),
    'xl/styles.xml': strToU8(stylesXml()),
  };

  return zipSync(files, { level: 6 });
}

export function sheetToXlsxBlob(input: XlsxInput): Blob {
  const bytes = sheetToXlsxBytes(input);
  return new Blob([bytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** Имя файла для скачивания, из названия документа. */
export function xlsxFileName(title: string): string {
  const base = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${base || 'Таблица'}.xlsx`;
}
