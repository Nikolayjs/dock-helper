export interface Icd10Entry {
  code: string;
  name: string;
}

/** Подрубрика внутри рубрики: класс и блок у неё те же, поэтому в ответе их нет. */
export interface Icd10Child extends Icd10Entry {
  hasNote: boolean;
}

/**
 * Строка оглавления — трёхзначная рубрика.
 *
 * Подрубрик здесь нет: они приезжают отдельным запросом и только когда понадобились. Но их
 * **число** известно сразу — иначе список не мог бы ответить, конечный это код или его надо
 * уточнять, а ради ответа пришлось бы тянуть все 12 587 уточнений.
 */
export interface Icd10ListRow extends Icd10Entry {
  chapter: string;
  /** Первый код блока — его неизменный ключ. По нему отбирает специальность врача. */
  blockFrom: string;
  blockRange: string;
  blockName: string;
  hasNote: boolean;
  childCount: number;
}

/** Подрубрики всех рубрик разом: рубрика → её уточнения. */
export type Icd10ChildrenMap = Record<string, Icd10Child[]>;

/**
 * Строка таблицы: рубрика или подрубрика.
 *
 * Список разворачивается в плоский только на отрисовке, и подрубрика всегда идёт следом за своей
 * рубрикой — при любой сортировке. Иначе `I21.0` окажется рядом с чужим кодом и прочитается как
 * самостоятельный диагноз, а не как уточнение инфаркта.
 */
export interface Icd10Row extends Icd10Entry {
  chapter: string;
  blockFrom: string;
  blockRange: string;
  blockName: string;
  hasNote: boolean;
  /** 0 — рубрика, 1 — подрубрика. */
  depth: 0 | 1;
  /** Сколько подрубрик у рубрики; у подрубрики всегда 0. */
  children: number;
  /** Рубрика раскрыта — её уточнения идут следом. У подрубрики всегда false. */
  expanded: boolean;
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
