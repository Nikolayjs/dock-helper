export interface Icd10Entry {
  code: string;
  name: string;
}

/** Строка оглавления: только трёхзначные рубрики — подрубрики живут на карточке своей рубрики. */
export interface Icd10ListRow extends Icd10Entry {
  chapter: string;
  blockRange: string;
  blockName: string;
  children: number;
  hasNote: boolean;
}

export interface Icd10ChapterInfo {
  roman: string;
  name: string;
  blocks: { range: string; name: string }[];
}

export interface Icd10Card extends Icd10Entry {
  chapter: { roman: string; name: string };
  block: { range: string; name: string };
  parent: Icd10Entry | null;
  children: Icd10Entry[];
  /** Код можно поставить в диагноз. Рубрика с подрубриками конечной не является. */
  terminal: boolean;
  note: string | null;
}
