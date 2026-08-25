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

export interface PatternRule {
  id: string;
  title: string;
  severity: Severity;
  description?: string;
  causes: string[];
  match: (statuses: Record<string, ParamStatus>, values: Record<string, number>) => boolean;
}

export interface LabTestDefinition {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  parameters: LabParameter[];
  patterns: PatternRule[];
}

/** Age used to resolve age-banded ranges when the patient's age isn't specified. */
const DEFAULT_ADULT_AGE = 30;

function resolveRange(range: LabRange | SexRange | AgeBand[], sex: Sex, age?: number): LabRange {
  if (Array.isArray(range)) {
    const effectiveAge = age ?? DEFAULT_ADULT_AGE;
    const band =
      range.find(
        (b) => (b.minAge === undefined || effectiveAge >= b.minAge) && (b.maxAge === undefined || effectiveAge <= b.maxAge),
      ) ?? range[range.length - 1];
    return resolveRange(band.range, sex, age);
  }
  if ('male' in range) return range[sex];
  return range;
}

export function getParamRange(param: LabParameter, sex: Sex, age?: number): LabRange {
  return resolveRange(param.range, sex, age);
}
