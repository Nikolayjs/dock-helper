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
}

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
