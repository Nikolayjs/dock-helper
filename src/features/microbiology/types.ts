/**
 * Микробиология: справочник с сервера и бланк, который набирает врач.
 *
 * Типы справочника повторяют `dock-helper-api/src/microbiology/data/types.ts`. Дублирование то же
 * и по той же причине, что у анализатора: репозитории разные, общего пакета между ними нет, а
 * ответ сервера всё равно приходит как JSON — типы здесь описывают то, что приехало, а не то, что
 * лежит в базе.
 */

export type Gram = 'positive' | 'negative';

export type OrganismGroup =
  | 'enterobacterales'
  | 'nonfermenter'
  | 'staphylococcus'
  | 'streptococcus'
  | 'enterococcus'
  | 'haemophilus'
  | 'moraxella'
  | 'neisseria'
  | 'corynebacterium'
  | 'listeria'
  | 'anaerobe'
  | 'mycoplasma'
  | 'chlamydia'
  | 'yeast'
  | 'mold'
  | 'lactobacillus'
  | 'gardnerella'
  | 'other';

export interface Organism {
  key: string;
  name: string;
  ru: string;
  group: OrganismGroup;
  gram?: Gram;
  aliases: string[];
  note: string;
}

export type AntibioticClass = string;

export interface Antibiotic {
  key: string;
  name: string;
  klass: AntibioticClass;
  aliases: string[];
  routes: ('oral' | 'parenteral')[];
  notFor?: { locus: string; why: string }[];
  onlyFor?: { loci: string[]; why: string };
  note?: string;
}

export interface Threshold {
  lg: number;
  groups?: OrganismGroup[];
  organisms?: string[];
  why: string;
}

export type ContextFlag = 'symptomatic' | 'catheter' | 'pregnant' | 'preUrologic' | 'immunocompromised';

export interface Locus {
  key: string;
  label: string;
  short: string;
  flora: string[];
  contaminants?: string[];
  pathogens?: string[];
  threshold?: number;
  thresholds?: Threshold[];
  contextThresholds?: { when: 'symptomatic' | 'catheter'; lg: number; why: string }[];
  contextFlags?: ContextFlag[];
  sterile?: boolean;
  samplingNote: string;
  note: string;
}

export interface IntrinsicRule {
  id: string;
  groups?: OrganismGroup[];
  organisms?: string[];
  exceptOrganisms?: string[];
  classes?: AntibioticClass[];
  antibiotics?: string[];
  exceptAntibiotics?: string[];
  why: string;
}

export type Severity = 'info' | 'warning' | 'critical';

export interface PhenotypeRule {
  id: string;
  title: string;
  groups?: OrganismGroup[];
  organisms?: string[];
  when: { antibiotics: string[]; is: 'R' | 'S'; mode: 'any' | 'all' }[];
  severity: Severity;
  meaning: string;
  invalidates?: { classes?: AntibioticClass[]; antibiotics?: string[]; why: string };
}

export type Significance =
  | 'pathogen'
  | 'significant'
  | 'below-threshold'
  | 'flora'
  | 'contaminant'
  | 'unknown';


export interface ClinicalRule {
  id: string;
  title: string;
  severity: Severity;
  text: string;
  scope: 'isolate' | 'report';
  loci?: string[];
  organisms?: string[];
  groups?: OrganismGroup[];
  significance?: Significance[];
  requireContext?: ContextFlag[];
  forbidContext?: ContextFlag[];
  report?: { noGrowth?: boolean; minIsolates?: number; anySignificant?: boolean };
}

export interface MicrobiologyReference {
  version: string;
  organisms: Organism[];
  antibiotics: Antibiotic[];
  loci: Locus[];
  intrinsic: IntrinsicRule[];
  phenotypes: PhenotypeRule[];
  clinical: ClinicalRule[];
}

// ── Бланк, который набирает врач ───────────────────────────────────────────────────────────────

/**
 * Результат по одному препарату.
 *
 * `I` со времён пересмотра EUCAST 2019 означает не «промежуточный», а **«чувствителен при
 * увеличенной экспозиции»**: препарат годится, но в высокой дозе и там, где он концентрируется.
 * Читать его как «лучше не назначать» — распространённая и дорогая ошибка: так теряется половина
 * работающих бета-лактамов.
 */
export type SusceptibilityResult = 'S' | 'I' | 'R';

export interface SusceptibilityEntry {
  antibioticKey: string;
  /** Как напечатано в бланке — остаётся, когда препарат не опознан. */
  label?: string;
  result: SusceptibilityResult;
}

/**
 * Степень роста, когда лаборатория не считает КОЕ.
 *
 * Полуколичественная оценка по секторам чашки: I — скудный, IV — массивный. В КОЕ она не
 * переводится точно, и притворяться, что переводится, нельзя: обильный рост означает «много», а не
 * «10⁵». Поэтому движок судит по ней грубее и говорит об этом.
 */
export type GrowthDegree = 1 | 2 | 3 | 4;

export interface Isolate {
  uid: string;
  organismKey?: string;
  /** Как напечатано в бланке; остаётся, когда возбудитель не опознан справочником. */
  organismLabel?: string;
  /** Десятичный логарифм КОЕ/мл: 5 значит 10⁵. */
  lgCfu?: number;
  growthDegree?: GrowthDegree;
  susceptibility: SusceptibilityEntry[];
}

export interface CultureReport {
  locusKey: string;
  /** Роста нет — это ответ, а не пустой бланк, и толкуется он отдельно. */
  noGrowth: boolean;
  context: ContextFlag[];
  isolates: Isolate[];
}

/**
 * Подробный разбор возбудителя — то, что читают, а не то, чем считают.
 *
 * В справочник (`MicrobiologyReference`) он **не входит и не должен**: справочник скачивает каждый,
 * кто открыл разбор посева, и нужен он там для счёта, а не для чтения. Разборы едут по одному,
 * своей ручкой, и только когда карточку действительно открыли, — та же пара «сводка в списке,
 * полная запись по ключу», что у формуляра и картотеки.
 */
export interface OrganismProfile {
  key: string;
  summary: string;
  habitat: string;
  causes: string[];
  significance: string;
  resistance: string;
  treatment: string;
  pitfalls: string[];
  /** Коды МКБ-10: дорога отсюда в классификацию, а из неё — в клинические рекомендации. */
  icd10?: string[];
}
