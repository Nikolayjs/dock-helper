/**
 * Документ врача: направление на экспертизу, справка, реестр — всё, что врач пишет сам.
 *
 * От бланка отличается тем, что это готовая бумага, а не заготовка с подстановками: бланк
 * печатается для пациента и визита, документ существует сам по себе, а привязка к пациенту у него
 * необязательная.
 */
export type DoctorDocumentKind = 'text' | 'sheet';

export interface DocumentSheet {
  columns: string[];
  rows: string[][];
  /**
   * Строка итогов — если врач её завёл.
   *
   * Отдельным полем, а не последней строкой среди прочих, ровно по одной причине: её **нельзя
   * сортировать**. Сортировка переставляет строки данных, и итог, оказавшийся посреди реестра,
   * — это не мелкий изъян, а неверная бумага.
   */
  totals?: string[] | null;
  /**
   * Оформление ячеек — разрежённая карта по адресу `строка:столбец` в номерах Excel.
   *
   * Плотная сетка весила бы столько же, сколько сама таблица, а размечены обычно шапка да пара
   * столбцов. Формат ездит вместе со своей ячейкой при вставке, удалении и сортировке — см.
   * `remapFormats`.
   */
  formats?: SheetFormats | null;
  /** Ширина столбцов в знаках; отсутствующая считается по содержимому. */
  widths?: (number | null)[] | null;
}

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Заливка, RRGGBB без решётки — в том виде, в каком её принимает Excel. */
  fill?: string;
  /** Числовой формат ячейки; текстовые ячейки он не трогает. */
  numberFormat?: 'integer' | 'decimal' | 'money' | 'percent';
  /** Переносить длинный текст по словам вместо того, чтобы прятать его за краем. */
  wrap?: boolean;
}

export type SheetFormats = Record<string, CellFormat>;

export interface DoctorDocument {
  id: string;
  kind: DoctorDocumentKind;
  title: string;
  summary: string;
  /** Пациент, к которому относится документ, или null. Ссылка может повиснуть — пациента удаляют, документ остаётся. */
  patientId: string | null;
  /** HTML из редактора; используется при kind === 'text'. */
  content: string;
  /** Таблица; используется при kind === 'sheet'. */
  sheet: DocumentSheet | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const KIND_LABEL: Record<DoctorDocumentKind, string> = {
  text: 'Word',
  sheet: 'Excel',
};

/** Пустая таблица нового документа: три столбца и три строки — сетка, в которую сразу можно печатать. */
export function blankSheet(): DocumentSheet {
  return {
    columns: ['Столбец 1', 'Столбец 2', 'Столбец 3'],
    rows: Array.from({ length: 3 }, () => ['', '', '']),
  };
}
