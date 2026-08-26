import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

import { formulaKey, readFormulasFromXlsx } from './readFormulas';

/**
 * Лист в том виде, в каком его пишет настоящий Excel.
 *
 * Разметка ниже — дословный вывод Excel 16 для столбца, протянутого вниз: текст формулы лежит
 * только у первой ячейки группы (`si="0"` вместе с `ref`), а у остальных остаётся пустой `<f>` со
 * ссылкой на неё. Проверено на файле, созданном самим Excel; здесь эта форма закреплена, чтобы
 * разбор не сломался незаметно.
 */
function sheetPackage(rows: string): Uint8Array {
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Лист1" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Type="x/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows}</sheetData></worksheet>`),
  });
}

describe('readFormulasFromXlsx', () => {
  it('читает обычную формулу и переводит имя на русский', () => {
    const map = readFormulasFromXlsx(sheetPackage('<row r="7"><c r="B7"><f>SUM(B4:B6)</f><v>14400</v></c></row>'));
    expect(map.get(formulaKey(7, 1))).toBe('=СУММ(B4:B6)');
  });

  it('разворачивает протянутый вниз столбец', () => {
    // Ячейка B6 несёт только ссылку на группу — без разворачивания в таблице оказалась бы формула
    // в первой строке столбца и застывшие числа во всех остальных.
    const map = readFormulasFromXlsx(
      sheetPackage(
        '<row r="5"><c r="B5"><f t="shared" ref="B5:B6" si="0">A5*600</f><v>1800</v></c></row>' +
          '<row r="6"><c r="B6"><f t="shared" si="0"/><v>4200</v></c></row>',
      ),
    );
    expect(map.get(formulaKey(5, 1))).toBe('=A5*600');
    expect(map.get(formulaKey(6, 1))).toBe('=A6*600');
  });

  it('сдвигает и по столбцам, если группа протянута вправо', () => {
    const map = readFormulasFromXlsx(
      sheetPackage(
        '<row r="4"><c r="B4"><f t="shared" ref="B4:C4" si="0">B3*2</f><v>1</v></c>' +
          '<c r="C4"><f t="shared" si="0"/><v>2</v></c></row>',
      ),
    );
    expect(map.get(formulaKey(4, 2))).toBe('=C3*2');
  });

  it('переводит запятую в точку с запятой, не трогая текст', () => {
    const map = readFormulasFromXlsx(
      sheetPackage('<row r="2"><c r="A2" t="str"><f>IF(B2&gt;1,&quot;раз, два&quot;,&quot;нет&quot;)</f><v>нет</v></c></row>'),
    );
    expect(map.get(formulaKey(2, 0))).toBe('=ЕСЛИ(B2>1;"раз, два";"нет")');
  });

  it('незнакомую функцию оставляет как есть', () => {
    // Честнее отдать её движку и получить #ИМЯ?, чем притвориться, что это что-то знакомое.
    const map = readFormulasFromXlsx(sheetPackage('<row r="2"><c r="A2"><f>VLOOKUP(A1,B:C,2)</f><v>1</v></c></row>'));
    expect(map.get(formulaKey(2, 0))).toBe('=VLOOKUP(A1;B:C;2)');
  });

  it('ячейки без формул в карту не попадают', () => {
    const map = readFormulasFromXlsx(sheetPackage('<row r="2"><c r="A2"><v>14</v></c></row>'));
    expect(map.size).toBe(0);
  });

  it('находит лист по книге, а не по имени файла', () => {
    // После удаления листа первым по счёту вполне может оказаться sheet3.xml.
    const bytes = zipSync({
      'xl/workbook.xml': strToU8(
        '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="Лист3" sheetId="3" r:id="rId9"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId9" Type="x/worksheet" Target="worksheets/sheet3.xml"/></Relationships>',
      ),
      'xl/worksheets/sheet3.xml': strToU8('<worksheet><sheetData><row r="2"><c r="A2"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>'),
    });
    expect(readFormulasFromXlsx(bytes).get(formulaKey(2, 0))).toBe('=1+1');
  });

  it('не роняет импорт на файле, который не архив', () => {
    expect(readFormulasFromXlsx(strToU8('это не .xlsx')).size).toBe(0);
  });
});
