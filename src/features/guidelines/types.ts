/** Строка списка клинических рекомендаций: всё, чем он рисуется. */
export interface GuidelineSummary {
  id: string;
  /** `<код>_<версия>` — идентификатор рубрикатора, он же наш и он же в адресе страницы. */
  codeVersion: string;
  code: number;
  version: number;
  name: string;
  mkbCodes: string[];
  /** Блоки МКБ-10 — по ним работает отбор по специальности врача. Считает сервер. */
  icdBlocks: string[];
  ageGroup: string;
  developers: string[];
  publishDate: string;
  /** Длина чистого текста: по ней видно, что рекомендация приехала целиком, а не огрызком. */
  textLength: number;
}

/** Раздел рекомендации. Якорь — его же идентификатор в рубрикаторе (`doc_diag_2_1`). */
export interface GuidelineSection {
  anchor: string;
  title: string;
  html: string;
}

/** Сведения и оглавление. Текст приезжает отдельным запросом — он в десять раз тяжелее. */
export interface GuidelineDetails extends GuidelineSummary {
  toc: { anchor: string; title: string }[];
}

/** Ссылка на рекомендацию: столько, сколько нужно строке в карточке болезни или кода МКБ-10. */
export interface GuidelineLink {
  codeVersion: string;
  name: string;
  ageGroup: string;
}
