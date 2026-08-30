export type Sex = 'male' | 'female';
export type ParamStatus = 'low' | 'high' | 'normal';
export type Severity = 'info' | 'warning' | 'critical';

export interface LabRange {
  min?: number;
  max?: number;
}

type SexRange = { male: LabRange; female: LabRange };

/** A reference range valid for an age interval, in years (both bounds inclusive). Omit a bound to leave it open. */
export interface AgeBand {
  minAge?: number;
  maxAge?: number;
  range: LabRange | SexRange;
}

export type ParamRange = LabRange | SexRange | AgeBand[];

export interface LabParameterOption {
  label: string;
  value: number;
}

export interface LabParameter {
  key: string;
  label: string;
  /** Other names this analyte is printed under, used when matching an uploaded file. Never shown in the form. */
  aliases?: string[];
  unit?: string;
  decimals?: number;
  step?: number;
  /** 'derived' parameters are computed from other entered values (see `derive`) and rendered read-only. */
  inputType: 'number' | 'select' | 'derived';
  options?: LabParameterOption[];
  range: ParamRange;
  lowLabel?: string;
  highLabel?: string;
  lowCauses?: string[];
  highCauses?: string[];
  /** For inputType 'derived': computes the value from other parameters' numeric values. */
  derive?: (values: Record<string, number>) => number | undefined;
  /** For inputType 'derived': shown in place of the usual placeholder, e.g. what it's calculated from. */
  derivedNote?: string;
}

/**
 * Про кого анализ — то, что известно о пациенте помимо самих значений.
 *
 * Пол уже влияет на нормы, но норма отвечает на вопрос «нормальное ли это число», а правило — на
 * другой: «относится ли это заключение к этому пациенту». Ферритин ниже нормы у женщины и у мужчины
 * читается по-разному, и правилу нужен способ это сказать.
 */
export interface PatternContext {
  sex: Sex;
  age?: number;
}

export interface PatternRule {
  id: string;
  title: string;
  severity: Severity;
  description?: string;
  causes: string[];
  match: (statuses: Record<string, ParamStatus>, values: Record<string, number>, context: PatternContext) => boolean;
}

export interface LabTestDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  parameters: LabParameter[];
  patterns: PatternRule[];
}

/**
 * Возраст, по которому берутся возрастные нормы, когда возраст пациента не указан.
 *
 * Значение видно врачу: результаты помечаются строкой «нормы взяты для взрослого 30 лет». Молчать
 * здесь нельзя — тогда детский анализ считался бы по взрослым нормам без единого признака этого.
 */
export const DEFAULT_ADULT_AGE = 30;

/** Есть ли у параметра возрастные полосы — то есть меняется ли его норма с возрастом. */
export function hasAgeBands(param: LabParameter): boolean {
  return Array.isArray(param.range) && param.range.length > 0;
}

/**
 * Полоса, по которой считается норма.
 *
 * Возраст, не попавший ни в одну полосу, берёт **ближайшую по границе**, а не последнюю в списке.
 * Прежнее «последняя в массиве» означало обычно взрослую: при полосах «5–12, 12–18, 18+» ребёнок
 * трёх лет молча получал взрослые нормы — то есть ответ, неверный ровно там, где нормы и отличаются
 * сильнее всего. Ближайшая полоса тоже приблизительна, но приблизительна в понятную сторону, и о
 * подстановке говорится в результатах.
 *
 * При равном расстоянии выигрывает первая по списку: порядок полос задаёт автор анализатора.
 */
function pickAgeBand(bands: AgeBand[], age: number): AgeBand | undefined {
  let nearest: AgeBand | undefined;
  let nearestDistance = Infinity;

  for (const band of bands) {
    const distance =
      band.minAge !== undefined && age < band.minAge
        ? band.minAge - age
        : band.maxAge !== undefined && age > band.maxAge
          ? age - band.maxAge
          : 0;
    if (distance === 0) return band;
    if (distance < nearestDistance) {
      nearest = band;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function resolveRange(range: LabRange | SexRange | AgeBand[], sex: Sex, age?: number): LabRange {
  if (Array.isArray(range)) {
    const band = pickAgeBand(range, age ?? DEFAULT_ADULT_AGE);
    // Пустой список полос — это анализатор без норм для этого показателя: тогда отклонения нет
    // вовсе, а не «всё в норме по чужой полосе».
    return band ? resolveRange(band.range, sex, age) : {};
  }
  if ('male' in range) return range[sex];
  return range;
}

/** Попал ли возраст ровно в одну из полос параметра. Возраст вне полос — повод сказать об этом. */
export function isAgeWithinBands(param: LabParameter, age: number): boolean {
  if (!Array.isArray(param.range)) return true;
  return param.range.some(
    (band) => (band.minAge === undefined || age >= band.minAge) && (band.maxAge === undefined || age <= band.maxAge),
  );
}

export function getParamRange(param: LabParameter, sex: Sex, age?: number): LabRange {
  return resolveRange(param.range, sex, age);
}
