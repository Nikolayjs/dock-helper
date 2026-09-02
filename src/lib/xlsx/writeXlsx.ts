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

import type { CellFormat, SheetFormats } from '../../features/documents/types';
import { numberFormatCode } from '../../features/documents/sheetFormat';
import { columnLetter } from '../sheet/cellRef';
import { cellNumber, evaluateCell, excelError, formatNumber, formulaForExcel, isError, isFormula } from '../sheet/formula';

export interface XlsxInput {
  /** Имя листа; берётся из названия документа и приводится к тому, что разрешает Excel. */
  sheetName: string;
  columns: string[];
  rows: string[][];
  /** Строка итогов, если врач её завёл: идёт последней и печатается полужирным, как заголовки. */
  totals?: string[] | null;
  /** Оформление ячеек по адресу `строка:столбец` в номерах Excel. */
  formats?: SheetFormats | null;
  /** Ширина столбцов в знаках; `null` — считать по содержимому. */
  widths?: (number | null)[] | null;
  /**
   * Высота строк данных в пунктах; `null` — оставить Excel считать по содержимому.
   *
   * Массив идёт параллельно `rows`, то есть без строки заголовков и без итогов: у них своей высоты
   * нет, и приписывать им чужую значило бы сдвинуть всю таблицу на строку.
   */
  heights?: (number | null)[] | null;
}

export { columnLetter };

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
  // Правило одно и живёт рядом с вычислителем: числом в файле обязано стать ровно то, что движок
  // считает числом на экране. Иначе Excel пересчитает нашу же формулу по своим правилам и покажет
  // другой итог — тот же разлад, что был у `1,5` между `=СУММ` и `=B2+B3`.
  return cellNumber(value);
}

/**
 * Формульная ячейка: в файл уходит **сама формула**, а рядом — вычисленное нами значение.
 *
 * Значение здесь не дубль, а обязательная часть: без него Excel показывает пустую ячейку до первого
 * пересчёта, а просмотрщики, которые не считают вовсе (в том числе наш импортёр и предпросмотр
 * почты), не показали бы ничего никогда. При открытии Excel пересчитает формулу и заменит наше
 * значение своим — если они разойдутся, верным окажется его.
 */
function formulaCellXml(reference: string, raw: string, grid: string[][], row: number, col: number): string {
  const formula = escapeXml(formulaForExcel(raw));
  const value = evaluateCell(grid, row, col);

  if (isError(value)) return `<c r="${reference}" t="e"><f>${formula}</f><v>${escapeXml(excelError(value.error))}</v></c>`;
  if (typeof value === 'number') return `<c r="${reference}"><f>${formula}</f><v>${formatNumber(value)}</v></c>`;
  if (typeof value === 'boolean') return `<c r="${reference}" t="b"><f>${formula}</f><v>${value ? 1 : 0}</v></c>`;
  // t="str" — это формула, вернувшая текст; inlineStr для формульной ячейки недопустим.
  return `<c r="${reference}" t="str"><f>${formula}</f><v>${escapeXml(value)}</v></c>`;
}

function cellXml(
  reference: string,
  value: string,
  styleId: number,
  bold: boolean,
  grid: string[][],
  row: number,
  col: number,
): string {
  const style = styleId ? ` s="${styleId}"` : '';
  if (isFormula(value)) {
    const cell = formulaCellXml(reference, value, grid, row, col);
    return styleId ? cell.replace(/^<c r="[^"]+"/, (head) => `${head} s="${styleId}"`) : cell;
  }
  if (!value) return `<c r="${reference}"${style}/>`;

  // В строке заголовков и в подписи итогов число — это всё-таки подпись, а не величина.
  const number = bold ? null : numericValue(value);
  if (number !== null) return `<c r="${reference}"${style}><v>${number}</v></c>`;

  // xml:space="preserve" — иначе разборщик съест ведущие и хвостовые пробелы, а в ячейке
  // «  до уточнения» отступ может быть намеренным.
  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/**
 * Оформление ячейки: то, что задал врач, поверх полужирного для заголовков и строки итогов.
 *
 * Служебное начертание идёт первым слоем, а не последним: врач, покрасивший шапку в жёлтый,
 * не должен терять её жирный шрифт, но, сняв полужирный явно, должен его снять.
 */
function formatOf(formats: SheetFormats | null | undefined, row: number, column: number, bold: boolean): CellFormat {
  const own = formats?.[`${row}:${column}`] ?? {};
  return bold ? { bold: true, ...own } : own;
}

function rowXml(
  cells: string[],
  rowNumber: number,
  bold: boolean,
  grid: string[][],
  input: XlsxInput,
  styles: StyleTable,
): string {
  // `ht` без `customHeight` Excel игнорирует: он считает такую высоту своей, посчитанной по
  // содержимому, и при первом же пересчёте её перетирает.
  const points = input.heights?.[rowNumber - 2];
  const height = points ? ` ht="${points}" customHeight="1"` : '';
  const body = cells
    .map((value, index) =>
      cellXml(
        `${columnLetter(index)}${rowNumber}`,
        value,
        styles.indexOf(formatOf(input.formats, rowNumber, index, bold)),
        bold,
        grid,
        rowNumber,
        index,
      ),
    )
    .join('');
  return `<row r="${rowNumber}"${height}>${body}</row>`;
}

/**
 * Ширина по самой длинной ячейке столбца, в разумных пределах: узкий столбец режет текст, широкий
 * выталкивает соседей за экран.
 */
function columnWidths(input: XlsxInput, grid: string[][]): number[] {
  return input.columns.map((column, index) => {
    // По вычисленным значениям: столбец из формул иначе мерился бы длиной их текста, а в файле
    // видны будут числа.
    const manual = input.widths?.[index];
    if (manual) return Math.min(120, Math.max(4, manual));

    let longest = column.length;
    for (let row = 1; row < grid.length; row++) {
      const raw = grid[row]?.[index] ?? '';
      longest = Math.max(longest, isFormula(raw) ? displayLength(grid, row + 1, index) : raw.length);
    }
    return Math.min(60, Math.max(8, longest + 2));
  });
}

function displayLength(grid: string[][], row: number, col: number): number {
  const value = evaluateCell(grid, row, col);
  if (isError(value)) return value.error.length;
  if (typeof value === 'number') return formatNumber(value).length;
  return String(value).length;
}

function sheetXml(input: XlsxInput, styles: StyleTable): string {
  const grid = gridOf(input);
  const widths = columnWidths(input, grid);
  const cols = widths.length
    ? `<cols>${widths
        .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  const rows = grid
    .map((cells, index) =>
      rowXml(cells, index + 1, index === 0 || (!!input.totals && index === grid.length - 1), grid, input, styles),
    )
    .join('');

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

/** Лист целиком, в той же нумерации, что видят формулы: заголовки — строка 1. */
function gridOf(input: XlsxInput): string[][] {
  return input.totals ? [input.columns, ...input.rows, input.totals] : [input.columns, ...input.rows];
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
 * Таблица стилей собирается по тому, что в документе действительно встретилось.
 *
 * В `.xlsx` оформление ячейки — не набор свойств на самой ячейке, а **номер строки** в общей
 * таблице `cellXfs`; шрифты, заливки и числовые форматы лежат в своих списках, и ячейка ссылается
 * на них номерами. Поэтому собрать стили можно только после обхода всех ячеек: сначала копим
 * встретившиеся сочетания, потом печатаем таблицу и раздаём номера.
 *
 * Две заливки в начале — не украшение: Excel требует, чтобы нулевая была `none`, а первая —
 * `gray125`, и файл с одной открывается через диалог восстановления.
 */
class StyleTable {
  /** Ключ сочетания → номер строки в cellXfs. Нулевая строка всегда обычная ячейка. */
  private readonly indexByKey = new Map<string, number>();
  private readonly entries: CellFormat[] = [{}];
  private readonly fonts: string[] = [];
  private readonly fills: string[] = [];
  private readonly numberFormats: string[] = [];

  /** Номер стиля для формата; одинаковые сочетания получают один номер, как и делает Excel. */
  indexOf(format: CellFormat): number {
    if (Object.keys(format).length === 0) return 0;
    const key = JSON.stringify([format.bold, format.italic, format.align, format.fill, format.numberFormat, format.wrap]);
    const known = this.indexByKey.get(key);
    if (known !== undefined) return known;

    const index = this.entries.length;
    this.entries.push(format);
    this.indexByKey.set(key, index);
    return index;
  }

  private fontId(format: CellFormat): number {
    if (!format.bold && !format.italic) return 0;
    // Полужирное уже есть под номером 1 — им набраны заголовки и строка итогов. Без этой ветки
    // каждый файл нёс бы второй, точно такой же шрифт.
    if (format.bold && !format.italic) return 1;
    const font =
      `<font>${format.bold ? '<b/>' : ''}${format.italic ? '<i/>' : ''}` +
      '<sz val="11"/><name val="Calibri"/><family val="2"/></font>';
    let id = this.fonts.indexOf(font);
    if (id === -1) id = this.fonts.push(font) - 1;
    // Ноль занят обычным начертанием, единица — полужирным для заголовков.
    return id + 2;
  }

  private fillId(format: CellFormat): number {
    if (!format.fill) return 0;
    const fill = `<fill><patternFill patternType="solid"><fgColor rgb="FF${format.fill}"/><bgColor indexed="64"/></patternFill></fill>`;
    let id = this.fills.indexOf(fill);
    if (id === -1) id = this.fills.push(fill) - 1;
    return id + 2;
  }

  private numFmtId(format: CellFormat): number {
    const code = numberFormatCode(format.numberFormat);
    if (!code) return 0;
    let id = this.numberFormats.indexOf(code);
    if (id === -1) id = this.numberFormats.push(code) - 1;
    // Номера ниже 164 зарезервированы Excel под встроенные форматы.
    return id + 164;
  }

  toXml(): string {
    const cellXfs = this.entries.map((format, index) => {
      if (index === 0) return '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
      const fontId = this.fontId(format);
      const fillId = this.fillId(format);
      const numFmtId = this.numFmtId(format);
      const alignment =
        format.align || format.wrap
          ? `<alignment${format.align ? ` horizontal="${format.align}"` : ''}${format.wrap ? ' wrapText="1"' : ''}/>`
          : '';
      const flags =
        `${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}` +
        `${numFmtId ? ' applyNumberFormat="1"' : ''}${alignment ? ' applyAlignment="1"' : ''}`;
      return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${flags}>${alignment}</xf>`;
    });

    const numFmts = this.numberFormats.length
      ? `<numFmts count="${this.numberFormats.length}">` +
        this.numberFormats.map((code, index) => `<numFmt numFmtId="${index + 164}" formatCode="${escapeXml(code)}"/>`).join('') +
        '</numFmts>'
      : '';

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<styleSheet xmlns="${MAIN_NS}">` +
      numFmts +
      `<fonts count="${this.fonts.length + 2}">` +
      '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
      '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>' +
      this.fonts.join('') +
      '</fonts>' +
      `<fills count="${this.fills.length + 2}">` +
      '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      this.fills.join('') +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>'
    );
  }
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
  // Лист собирается первым: стили — это номера строк в общей таблице, и напечатать её можно только
  // после того, как стало известно, какие сочетания в документе встретились.
  const styles = new StyleTable();
  const sheet = sheetXml(input, styles);

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
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/styles.xml': strToU8(styles.toXml()),
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
