import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import readXlsxFile from 'read-excel-file/node';

import { cellsToStrings } from './readSheet';
import { columnLetter, numericValue, sheetNameFrom, sheetToXlsxBytes, xlsxFileName } from './writeXlsx';
import { ERRORS } from '../sheet/formula';

/**
 * Читает только что записанный файл тем же разборщиком, которым приложение читает чужие таблицы.
 *
 * Это и есть главная защита конвертера. Битую часть пакета Excel молча чинит при открытии — и
 * повреждение всплыло бы у врача, а не здесь; наш импортёр не чинит ничего.
 */
async function roundTrip(input: Parameters<typeof sheetToXlsxBytes>[0]) {
  const bytes = sheetToXlsxBytes(input);
  // Без указания листа версия 9 отдаёт `{ sheet, data }` по каждому листу — та же форма, которую
  // разбирает `readTable.ts`. Разворачиваем её здесь, чтобы проверки говорили о строках.
  // Blob, а не Buffer: типов Node в этом проекте нет, а разборщик принимает и то и другое.
  const blob = new Blob([bytes as unknown as BlobPart]);
  const [first] = (await readXlsxFile(blob as never)) as unknown as { sheet: string; data: unknown[][] }[];
  return first.data;
}

function partOf(bytes: Uint8Array, path: string): string {
  return strFromU8(unzipSync(bytes)[path]);
}

describe('columnLetter', () => {
  it('нумерует столбцы так же, как Excel', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(51)).toBe('AZ');
    expect(columnLetter(52)).toBe('BA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });
});

describe('numericValue', () => {
  it('признаёт простые числа', () => {
    expect(numericValue('5')).toBe(5);
    expect(numericValue('0')).toBe(0);
    expect(numericValue('-3')).toBe(-3);
    expect(numericValue('5.25')).toBe(5.25);
    expect(numericValue(' 42 ')).toBe(42);
  });

  it('оставляет текстом то, что числом быть не должно', () => {
    // Телефон: числом он превратился бы в 8,91235E+10.
    expect(numericValue('89123456789')).toBeNull();
    // Номер с ведущим нулём: в числе ноль пропадёт.
    expect(numericValue('007')).toBeNull();
    expect(numericValue('12.09.2026')).toBeNull();
    expect(numericValue('1 000')).toBeNull();
    expect(numericValue('3,5')).toBeNull();
    expect(numericValue('')).toBeNull();
    expect(numericValue('до 3 дней')).toBeNull();
  });
});

describe('sheetNameFrom', () => {
  it('убирает запрещённые Excel символы', () => {
    expect(sheetNameFrom('Реестр: 2026/09')).toBe('Реестр 2026 09');
    expect(sheetNameFrom('А[1]*?')).toBe('А 1');
  });

  it('обрезает до 31 символа и не отдаёт пустое имя', () => {
    expect(sheetNameFrom('я'.repeat(60))).toHaveLength(31);
    expect(sheetNameFrom('   ')).toBe('Лист1');
    expect(sheetNameFrom('///')).toBe('Лист1');
  });
});

describe('xlsxFileName', () => {
  it('делает имя файла из названия документа', () => {
    expect(xlsxFileName('Реестр направлений')).toBe('Реестр направлений.xlsx');
    expect(xlsxFileName('  Отчёт: сентябрь ')).toBe('Отчёт сентябрь.xlsx');
    expect(xlsxFileName('')).toBe('Таблица.xlsx');
  });
});

describe('пакет .xlsx', () => {
  const bytes = sheetToXlsxBytes({ sheetName: 'Реестр', columns: ['Пациент'], rows: [['Иванов']] });

  it('содержит все части, которых Excel ждёт', () => {
    const files = Object.keys(unzipSync(bytes)).sort();
    expect(files).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('закрепляет строку заголовков и помечает её полужирным стилем', () => {
    const sheet = partOf(bytes, 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    // Строки данных обычным начертанием — иначе весь лист выйдет жирным.
    expect(sheet).toContain('<c r="A2" t="inlineStr">');
  });

  it('несёт две заливки, без которых Excel открывает файл через восстановление', () => {
    const styles = partOf(bytes, 'xl/styles.xml');
    expect(styles).toContain('<fills count="2">');
    expect(styles).toContain('patternType="gray125"');
  });

  it('задаёт ширину каждому столбцу', () => {
    const wide = sheetToXlsxBytes({
      sheetName: 'Л',
      columns: ['Кратко', 'Очень длинное название столбца'],
      rows: [['—', '—']],
    });
    const sheet = partOf(wide, 'xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<col min="1" max="1" width="8"');
    expect(sheet).toContain('<col min="2" max="2" width="32"');
  });
});

describe('круговой тест: запись и чтение обратно', () => {
  it('возвращает те же заголовки и значения', async () => {
    const rows = await roundTrip({
      sheetName: 'Реестр направлений',
      columns: ['Пациент', 'Экспертиза', 'Дата'],
      rows: [
        ['Иванов И. И.', 'МСЭ', '12.09.2026'],
        ['Петрова А. С.', 'ВК', '14.09.2026'],
      ],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['Пациент', 'Экспертиза', 'Дата']);
    expect(rows[1]).toEqual(['Иванов И. И.', 'МСЭ', '12.09.2026']);
    expect(rows[2]).toEqual(['Петрова А. С.', 'ВК', '14.09.2026']);
  });

  it('переживает символы, которые ломают XML', async () => {
    const rows = await roundTrip({
      sheetName: 'Л',
      columns: ['Примечание'],
      rows: [['Кровь & моча < 5 «норма» —  тире']],
    });
    expect(rows[1][0]).toBe('Кровь & моча < 5 «норма» —  тире');
  });

  it('выбрасывает управляющие символы, а не отдаёт нечитаемый файл', async () => {
    const rows = await roundTrip({
      sheetName: 'Л',
      columns: ['Текст'],
      rows: [['из буфера\u0007']],
    });
    expect(rows[1][0]).toBe('из буфера');
  });

  it('числа приходят числами, а телефон остаётся строкой', async () => {
    const rows = await roundTrip({
      sheetName: 'Л',
      columns: ['Доз', 'Телефон'],
      rows: [['12', '89123456789']],
    });
    expect(rows[1][0]).toBe(12);
    expect(rows[1][1]).toBe('89123456789');
  });

  it('пустая ячейка остаётся пустой, а не съезжает влево', async () => {
    const rows = await roundTrip({
      sheetName: 'Л',
      columns: ['А', 'Б', 'В'],
      rows: [['левая', '', 'правая']],
    });
    expect(rows[1]).toHaveLength(3);
    expect(rows[1][0]).toBe('левая');
    expect(rows[1][2]).toBe('правая');
  });

  it('таблица без строк — всё ещё файл с заголовками', async () => {
    const rows = await roundTrip({ sheetName: 'Пусто', columns: ['А', 'Б'], rows: [] });
    expect(rows).toEqual([['А', 'Б']]);
  });
});

describe('cellsToStrings', () => {
  it('приводит прочитанную таблицу к сетке редактора', () => {
    expect(
      cellsToStrings([
        ['Пациент', 'Дата', null],
        ['Иванов', new Date(Date.UTC(2026, 8, 12)), 3],
      ]),
    ).toMatchObject({
      columns: ['Пациент', 'Дата', 'Столбец 3'],
      rows: [['Иванов', '12.09.2026', '3']],
    });
  });

  it('выравнивает строки по числу заголовков', () => {
    expect(cellsToStrings([['А', 'Б'], ['только одна'], ['раз', 'два', 'лишняя']])).toMatchObject({
      columns: ['А', 'Б'],
      rows: [
        ['только одна', ''],
        ['раз', 'два'],
      ],
    });
  });

  it('пропускает пустые строки в начале файла', () => {
    expect(cellsToStrings([[], [null, null], ['Пациент'], ['Иванов']])).toMatchObject({
      columns: ['Пациент'],
      rows: [['Иванов']],
      // Строка «Иванов» была четвёртой в файле — это и нужно, чтобы сдвинуть её формулы.
      sourceRows: [4],
    });
  });

  it('на пустом файле отдаёт пустую таблицу, а не падает', () => {
    expect(cellsToStrings([])).toEqual({ columns: [], rows: [], sourceRows: [] });
  });
});


describe('формулы в файле', () => {
  const bytes = sheetToXlsxBytes({
    sheetName: 'Реестр',
    columns: ['Пациент', 'Дней', 'Сумма'],
    rows: [
      ['Иванов', '14', '=B2*600'],
      ['Петрова', '3', '=B3*600'],
    ],
    totals: ['Итого', '=СУММ(B2:B3)', '=СУММ(C2:C3)'],
  });
  const sheet = partOf(bytes, 'xl/worksheets/sheet1.xml');

  it('пишет саму формулу, а не только результат', () => {
    // Число без формулы означало бы, что Excel её никогда не пересчитает: правка соседней ячейки
    // оставила бы итог прежним.
    expect(sheet).toContain('<c r="C2"><f>B2*600</f><v>8400</v></c>');
  });

  it('переводит русские имена функций на английские', () => {
    // Формат хранит имена только по-английски; русский Excel покажет их по-русски сам.
    expect(sheet).toContain('<f>SUM(B2:B3)</f>');
    expect(sheet).not.toContain('СУММ');
  });

  it('кладёт рядом вычисленное значение', () => {
    // Без него ячейка пуста до первого пересчёта, а в просмотрщиках без движка — навсегда.
    expect(sheet).toContain('<f>SUM(C2:C3)</f><v>10200</v>');
  });

  it('печатает строку итогов полужирным, как заголовки', () => {
    expect(sheet).toContain('<c r="A4" s="1" t="inlineStr">');
    expect(sheet).toMatch(/<c r="B4" s="1"><f>SUM/);
  });

  it('ошибку отдаёт в том виде, в каком её понимает Excel', () => {
    const broken = partOf(
      sheetToXlsxBytes({ sheetName: 'Л', columns: ['A'], rows: [['0'], ['=1/A2']] }),
      'xl/worksheets/sheet1.xml',
    );
    expect(broken).toContain('<c r="A3" t="e"><f>1/A2</f><v>#DIV/0!</v></c>');
    expect(broken).not.toContain(ERRORS.div0);
  });

  it('формулу, вернувшую текст, помечает t="str"', () => {
    const text = partOf(
      sheetToXlsxBytes({ sheetName: 'Л', columns: ['A'], rows: [['1'], ['=ЕСЛИ(A2>0;"есть";"нет")']] }),
      'xl/worksheets/sheet1.xml',
    );
    expect(text).toContain('<c r="A3" t="str"><f>IF(A2&gt;0,&quot;есть&quot;,&quot;нет&quot;)</f><v>есть</v></c>');
  });

  it('ширина столбца считается по результату, а не по длине формулы', () => {
    const wide = partOf(
      sheetToXlsxBytes({ sheetName: 'Л', columns: ['И'], rows: [['1'], ['=A2+A2+A2+A2+A2+A2+A2']] }),
      'xl/worksheets/sheet1.xml',
    );
    expect(wide).toContain('<col min="1" max="1" width="8"');
  });
});

describe('круговой тест с формулами', () => {
  it('Excel-совместимый разборщик читает закешированные значения', async () => {
    const rows = await roundTrip({
      sheetName: 'Реестр',
      columns: ['Дней', 'Сумма'],
      rows: [
        ['14', '=A2*600'],
        ['3', '=A3*600'],
      ],
      totals: ['Итого', '=СУММ(B2:B3)'],
    });
    expect(rows[1]).toEqual([14, 8400]);
    expect(rows[2]).toEqual([3, 1800]);
    expect(rows[3]).toEqual(['Итого', 10200]);
  });
});
