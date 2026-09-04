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

/**
 * Раздел рекомендации. Якорь — его же идентификатор в рубрикаторе (`doc_diag_2_1`).
 *
 * `level` — глубина в оглавлении: «2. Диагностика» первого уровня, «2.4 Инструментальные
 * исследования» второго. Считает сервер, а не страница: оглавление обязано совпадать с телом
 * документа, а два места, выводящие структуру порознь, однажды разойдутся. У записей, привезённых
 * до пересборки корпуса, его может не быть — тогда оглавление плоское.
 */
export interface GuidelineSection {
  anchor: string;
  title: string;
  level?: 1 | 2;
  html: string;
}

/** Строка оглавления: то же, но без текста. */
export interface GuidelineTocItem {
  anchor: string;
  title: string;
  level?: 1 | 2;
}

/** Сведения и оглавление. Текст приезжает отдельным запросом — он в десять раз тяжелее. */
export interface GuidelineDetails extends GuidelineSummary {
  toc: GuidelineTocItem[];
}

/** Ссылка на рекомендацию: столько, сколько нужно строке в карточке болезни или кода МКБ-10. */
export interface GuidelineLink {
  codeVersion: string;
  name: string;
  ageGroup: string;
}
