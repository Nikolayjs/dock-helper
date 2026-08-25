import { evaluateFormula } from '../../lib/formulaEngine';
import type { AgeBand, LabParameter, LabTestDefinition, ParamStatus, PatternRule, Severity } from './types';

// ---------------------------------------------------------------------------
// Backend-mirroring types — what dock-helper-api's /custom-lab-tests actually
// stores and returns (see dock-helper-api/src/analyzer/entities/custom-lab-test.entity.ts).
// Ranges nest sex-specific values instead of the draft editor's flat min/max,
// and pattern rules are a recursive AND/OR/NOT tree instead of the editor's flat
// operator+conditions list.
// ---------------------------------------------------------------------------

export interface BackendLabRange {
  min?: number;
  max?: number;
}

export interface BackendSexRange {
  male: BackendLabRange;
  female: BackendLabRange;
}

export type BackendRangeValue = BackendLabRange | BackendSexRange;

export interface BackendAgeBand {
  id: string;
  minAge?: number;
  maxAge?: number;
  range: BackendRangeValue;
}

export interface BackendLabParameterOption {
  label: string;
  value: number;
}

export interface BackendLabParameter {
  key: string;
  label: string;
  /** Alternative names for matching an uploaded lab file; not shown anywhere in the form. */
  aliases?: string[];
  unit?: string;
  decimals?: number;
  step?: number;
  inputType: 'number' | 'select' | 'derived';
  options?: BackendLabParameterOption[];
  range?: BackendRangeValue;
  ageBands?: BackendAgeBand[];
  deriveFormula?: string;
  derivedNote?: string;
  lowLabel?: string;
  highLabel?: string;
  lowCauses: string[];
  highCauses: string[];
}

export type PatternNode =
  | { type: 'condition'; paramKey: string; status: ParamStatus; negate?: boolean }
  | { type: 'group'; operator: 'and' | 'or'; children: PatternNode[] };

export interface BackendPatternRule {
  id: string;
  title: string;
  severity: Severity;
  description?: string;
  causes: string[];
  root: PatternNode;
}

export interface BackendLabTest {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  parameters: BackendLabParameter[];
  patterns: BackendPatternRule[];
  createdAt: string;
  updatedAt: string;
}

export type CreateLabTestPayload = Omit<BackendLabTest, 'id' | 'createdAt' | 'updatedAt'>;

// ---------------------------------------------------------------------------
// Draft/editor types — what the builder UI (ParameterEditorRow, PatternRuleEditorRow)
// renders and edits. Kept close to their pre-migration flat shape: single min/max per
// parameter or per age band, single operator across a flat condition list. A parameter
// or rule whose backend structure can't be expressed that way (a sex-specific range
// split, or a pattern tree deeper than one flat group) is marked `locked`/`rangeLocked`:
// its structural fields are hidden behind a read-only summary and passed through to the
// payload unchanged, while everything else about it (label, causes, severity...) stays
// editable normally.
// ---------------------------------------------------------------------------

export type CustomParamInputType = 'number' | 'select' | 'derived';

export interface CustomLabParameterOption {
  label: string;
  value: number;
}

export interface CustomAgeBand {
  id: string;
  minAge?: number;
  maxAge?: number;
  min?: number;
  max?: number;
}

export interface CustomLabParameter {
  key: string;
  label: string;
  /** Alternative names for matching an uploaded lab file; not shown anywhere in the form. */
  aliases?: string[];
  unit?: string;
  decimals?: number;
  step?: number;
  inputType: CustomParamInputType;
  options?: CustomLabParameterOption[];
  min?: number;
  max?: number;
  ageBands?: CustomAgeBand[];
  lowLabel?: string;
  highLabel?: string;
  lowCauses: string[];
  highCauses: string[];
  /** Present only for inputType 'derived'. No formula-editing UI — preserved verbatim on save. */
  deriveFormula?: string;
  derivedNote?: string;
  /** True when the stored range has a male/female split (as the whole range or within an age band) — the flat editor above can't represent that, so `rawRange`/`rawAgeBands` carry the untouched original instead. */
  rangeLocked?: boolean;
  rawRange?: BackendRangeValue;
  rawAgeBands?: BackendAgeBand[];
}

export type PatternOperator = 'and' | 'or';

export interface PatternCondition {
  id: string;
  paramKey: string;
  status: ParamStatus;
  negate?: boolean;
}

export interface CustomPatternRule {
  id: string;
  title: string;
  severity: Severity;
  /** Not editable in the builder today (no field for it) — preserved verbatim on save. */
  description?: string;
  causes: string[];
  operator: PatternOperator;
  conditions: PatternCondition[];
  /** True when the stored root is a deeper/negated tree than one flat group — `rawRoot` is preserved and passed through unmodified on save; only title/severity/causes stay editable. */
  locked?: boolean;
  rawRoot?: PatternNode;
}

export interface LabTestDraft {
  title: string;
  shortTitle: string;
  description: string;
  parameters: CustomLabParameter[];
  patterns: CustomPatternRule[];
}

// ---------------------------------------------------------------------------
// Runtime engine mapper — backend shape -> the closures analyzerEngine.ts consumes.
// ---------------------------------------------------------------------------

function evalPatternNode(node: PatternNode, statuses: Record<string, ParamStatus>): boolean {
  if (node.type === 'condition') {
    const result = statuses[node.paramKey] === node.status;
    return node.negate ? !result : result;
  }
  return node.operator === 'and'
    ? node.children.every((child) => evalPatternNode(child, statuses))
    : node.children.some((child) => evalPatternNode(child, statuses));
}

function toEngineRange(param: BackendLabParameter): LabParameter['range'] {
  if (param.ageBands && param.ageBands.length > 0) {
    return param.ageBands.map(
      (band): AgeBand => ({ minAge: band.minAge, maxAge: band.maxAge, range: band.range }),
    );
  }
  return param.range ?? {};
}

export function toLabTestDefinition(test: BackendLabTest): LabTestDefinition {
  return {
    id: test.id,
    title: test.title,
    shortTitle: test.shortTitle,
    description: test.description,
    parameters: test.parameters.map((param): LabParameter => ({
      key: param.key,
      label: param.label,
      aliases: param.aliases,
      unit: param.unit,
      decimals: param.decimals,
      step: param.step,
      inputType: param.inputType,
      options: param.options,
      range: toEngineRange(param),
      lowLabel: param.lowLabel,
      highLabel: param.highLabel,
      lowCauses: param.lowCauses,
      highCauses: param.highCauses,
      // evaluateFormula throws on a variable missing from `values` (by design, so the calculator
      // builder can catch typos) — here `values` is only ever a partial set of what the doctor has
      // entered so far, so a missing input just means "can't compute yet", not an error.
      derive:
        param.inputType === 'derived' && param.deriveFormula
          ? (values) => {
              try {
                return evaluateFormula(param.deriveFormula!, values);
              } catch {
                return undefined;
              }
            }
          : undefined,
      derivedNote: param.derivedNote,
    })),
    patterns: test.patterns.map((rule): PatternRule => ({
      id: rule.id,
      title: rule.title,
      severity: rule.severity,
      description: rule.description,
      causes: rule.causes,
      match: (statuses) => evalPatternNode(rule.root, statuses),
    })),
  };
}

// ---------------------------------------------------------------------------
// Builder mapper — backend shape <-> draft shape.
// ---------------------------------------------------------------------------

function isFlatRangeValue(range?: BackendRangeValue): boolean {
  return !range || !('male' in range);
}

function isFlatParameterRange(param: BackendLabParameter): boolean {
  if (param.ageBands && param.ageBands.length > 0) {
    return param.ageBands.every((band) => isFlatRangeValue(band.range));
  }
  return isFlatRangeValue(param.range);
}

function isFlatPatternRoot(node: PatternNode): boolean {
  return node.type === 'condition' || node.children.every((child) => child.type === 'condition');
}

function flattenPatternRoot(root: PatternNode): { operator: PatternOperator; conditions: PatternCondition[] } {
  if (root.type === 'condition') {
    return { operator: 'and', conditions: [{ id: crypto.randomUUID(), paramKey: root.paramKey, status: root.status, negate: root.negate }] };
  }
  return {
    operator: root.operator,
    conditions: root.children.map((child) => {
      const condition = child as Extract<PatternNode, { type: 'condition' }>;
      return { id: crypto.randomUUID(), paramKey: condition.paramKey, status: condition.status, negate: condition.negate };
    }),
  };
}

function buildPatternRoot(operator: PatternOperator, conditions: PatternCondition[]): PatternNode {
  return {
    type: 'group',
    operator,
    children: conditions.map((c) => ({ type: 'condition', paramKey: c.paramKey, status: c.status, negate: c.negate || undefined })),
  };
}

function hydrateParameter(param: BackendLabParameter): CustomLabParameter {
  const base = {
    key: param.key,
    label: param.label,
    aliases: param.aliases,
    unit: param.unit,
    decimals: param.decimals,
    step: param.step,
    inputType: param.inputType,
    options: param.options,
    lowLabel: param.lowLabel,
    highLabel: param.highLabel,
    lowCauses: param.lowCauses,
    highCauses: param.highCauses,
    deriveFormula: param.deriveFormula,
    derivedNote: param.derivedNote,
  };

  if (param.inputType === 'select') return base;

  if (!isFlatParameterRange(param)) {
    return { ...base, rangeLocked: true, rawRange: param.range, rawAgeBands: param.ageBands };
  }

  if (param.ageBands && param.ageBands.length > 0) {
    return {
      ...base,
      ageBands: param.ageBands.map((band): CustomAgeBand => ({
        id: band.id,
        minAge: band.minAge,
        maxAge: band.maxAge,
        min: (band.range as BackendLabRange).min,
        max: (band.range as BackendLabRange).max,
      })),
    };
  }

  const flat = param.range as BackendLabRange | undefined;
  return { ...base, min: flat?.min, max: flat?.max };
}

function draftParameterToPayload(param: CustomLabParameter): BackendLabParameter {
  const base = {
    key: param.key,
    label: param.label,
    aliases: param.aliases,
    unit: param.unit,
    decimals: param.decimals,
    step: param.step,
    inputType: param.inputType,
    options: param.options,
    lowLabel: param.lowLabel,
    highLabel: param.highLabel,
    lowCauses: param.lowCauses,
    highCauses: param.highCauses,
    deriveFormula: param.deriveFormula,
    derivedNote: param.derivedNote,
  };

  if (param.inputType === 'select') return { ...base, range: { min: 0, max: 0 } };

  if (param.rangeLocked) return { ...base, range: param.rawRange, ageBands: param.rawAgeBands };

  if (param.ageBands && param.ageBands.length > 0) {
    return {
      ...base,
      ageBands: param.ageBands.map((band): BackendAgeBand => ({
        id: band.id,
        minAge: band.minAge,
        maxAge: band.maxAge,
        range: { min: band.min, max: band.max },
      })),
    };
  }

  return { ...base, range: { min: param.min, max: param.max } };
}

function hydratePatternRule(rule: BackendPatternRule): CustomPatternRule {
  if (isFlatPatternRoot(rule.root)) {
    const { operator, conditions } = flattenPatternRoot(rule.root);
    return { id: rule.id, title: rule.title, severity: rule.severity, description: rule.description, causes: rule.causes, operator, conditions };
  }
  return {
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    description: rule.description,
    causes: rule.causes,
    operator: 'and',
    conditions: [],
    locked: true,
    rawRoot: rule.root,
  };
}

function draftPatternRuleToBackend(rule: CustomPatternRule): BackendPatternRule {
  return {
    id: rule.id,
    title: rule.title,
    severity: rule.severity,
    description: rule.description,
    causes: rule.causes,
    root: rule.locked && rule.rawRoot ? rule.rawRoot : buildPatternRoot(rule.operator, rule.conditions),
  };
}

export function hydrateLabTest(test: BackendLabTest): LabTestDraft {
  return {
    title: test.title,
    shortTitle: test.shortTitle,
    description: test.description,
    parameters: test.parameters.map(hydrateParameter),
    patterns: test.patterns.map(hydratePatternRule),
  };
}

export function labTestDraftToPayload(draft: LabTestDraft): CreateLabTestPayload {
  return {
    title: draft.title,
    shortTitle: draft.shortTitle,
    description: draft.description,
    parameters: draft.parameters.map(draftParameterToPayload),
    patterns: draft.patterns.map(draftPatternRuleToBackend),
  };
}

// ---------------------------------------------------------------------------
// Read-only summaries for locked parameters/rules.
// ---------------------------------------------------------------------------

function describeLabRange(range: BackendLabRange): string {
  if (range.min !== undefined && range.max !== undefined) return `${range.min}–${range.max}`;
  if (range.min !== undefined) return `от ${range.min}`;
  if (range.max !== undefined) return `до ${range.max}`;
  return '—';
}

function describeRangeValue(range?: BackendRangeValue): string {
  if (!range) return '—';
  if ('male' in range) return `М: ${describeLabRange(range.male)}; Ж: ${describeLabRange(range.female)}`;
  return describeLabRange(range);
}

export function describeLockedParamRange(param: CustomLabParameter): string {
  if (param.rawAgeBands && param.rawAgeBands.length > 0) {
    return param.rawAgeBands
      .map((band) => `${band.minAge ?? 0}–${band.maxAge ?? '∞'} лет: ${describeRangeValue(band.range)}`)
      .join('; ');
  }
  return describeRangeValue(param.rawRange);
}

const STATUS_TEXT: Record<ParamStatus, string> = { low: 'ниже нормы', normal: 'в норме', high: 'выше нормы' };

export function describePatternNode(node: PatternNode, paramLabel: (key: string) => string): string {
  if (node.type === 'condition') {
    const text = `${paramLabel(node.paramKey)} ${STATUS_TEXT[node.status]}`;
    return node.negate ? `НЕ (${text})` : text;
  }
  const joiner = node.operator === 'and' ? ' И ' : ' ИЛИ ';
  return node.children
    .map((child) => (child.type === 'group' ? `(${describePatternNode(child, paramLabel)})` : describePatternNode(child, paramLabel)))
    .join(joiner);
}
