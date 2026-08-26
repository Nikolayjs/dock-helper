import { unzipSync, strFromU8 } from 'fflate';

import { columnIndex, shiftFormula } from '../sheet/cellRef';
import { formulaFromExcel } from '../sheet/formula';

/**
 * Достаёт формулы из чужого файла .xlsx.
 *
 * Отдельным проходом, потому что `read-excel-file` их не отдаёт: он читает закешированное значение
 * из `<v>` и элемент `<f>` игнорирует — в его же исходниках написано почему («can't include the
 * whole formula calculation engine»). Без этого прохода таблица с формулами, выгруженная нами и
 * загруженная обратно, вернулась бы замороженными числами — ровно та потеря по кругу, из-за которой
 * в проекте отвергли приём `altChunk` для Word.
 *
 * Читается только первый лист — тот же, что читает `readTableFile`.
 */

/** Формулы по адресу: ключ — `строка:столбец`, где строка 1-based, а столбец 0-based. */
export type FormulaMap = Map<string, string>;

export function formulaKey(row: number, column: number): string {
  return `${row}:${column}`;
}

const CELL_PATTERN = /<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g;
const FORMULA_PATTERN = /<f\b([^>]*)(?:\/>|>([\s\S]*?)<\/f>)/;

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * Путь к первому листу книги.
 *
 * Через `workbook.xml` и его связи, а не по имени `sheet1.xml`: порядок листов в книге задаётся
 * первым, а имена файлов внутри архива Excel раздаёт как ему удобно, и после удаления листа первым
 * по счёту вполне может оказаться `sheet3.xml`.
 */
function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (workbook && rels) {
    const sheet = /<sheet\b[^>]*\/>/.exec(strFromU8(workbook));
    const id = sheet ? attribute(sheet[0], 'r:id') : null;
    if (id) {
      const relationship = new RegExp(`<Relationship\\b[^>]*Id="${id}"[^>]*>`).exec(strFromU8(rels));
      const target = relationship ? attribute(relationship[0], 'Target') : null;
      if (target) {
        const path = target.replace(/^\/?(xl\/)?/, 'xl/');
        if (files[path]) return path;
      }
    }
  }
  return files['xl/worksheets/sheet1.xml'] ? 'xl/worksheets/sheet1.xml' : null;
}

/**
 * «Общая» формула — приём Excel, которым он хранит протянутый вниз столбец: текст лежит только у
 * первой ячейки группы, а остальные ссылаются на неё номером `si`.
 *
 * Их приходится разворачивать самим, сдвигая относительные ссылки на разницу адресов. Оставить
 * такую группу как есть значило бы отдать таблицу, где формула стоит в первой строке столбца, а во
 * всех остальных — застывшие числа: наполовину живой реестр хуже, чем честно мёртвый.
 */
interface SharedMaster {
  row: number;
  column: number;
  formula: string;
}

export function readFormulasFromXlsx(bytes: Uint8Array): FormulaMap {
  const result: FormulaMap = new Map();

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    // Не .xlsx или битый архив: значения уже прочитаны, формул просто не будет.
    return result;
  }

  const path = firstSheetPath(files);
  if (!path) return result;

  const xml = strFromU8(files[path]);
  const shared = new Map<string, SharedMaster>();

  CELL_PATTERN.lastIndex = 0;
  for (let cell = CELL_PATTERN.exec(xml); cell !== null; cell = CELL_PATTERN.exec(xml)) {
    const column = columnIndex(cell[1]);
    const row = Number(cell[2]);
    const formula = FORMULA_PATTERN.exec(cell[3]);
    if (!formula) continue;

    const attributes = formula[1] ?? '';
    const body = formula[2] ? unescapeXml(formula[2]) : '';
    const kind = attribute(attributes, 't');
    const si = attribute(attributes, 'si');

    if (kind === 'shared' && si !== null) {
      if (body) {
        shared.set(si, { row, column, formula: body });
        result.set(formulaKey(row, column), formulaFromExcel(body));
      } else {
        const master = shared.get(si);
        if (master) {
          const moved = shiftFormula(`=${master.formula}`, row - master.row, column - master.column).slice(1);
          result.set(formulaKey(row, column), formulaFromExcel(moved));
        }
      }
      continue;
    }

    // Формулы массива и общие без текста мастера пропускаем: подставить нечего, и остаётся
    // значение, которое разборщик уже прочитал.
    if (body) result.set(formulaKey(row, column), formulaFromExcel(body));
  }

  return result;
}
