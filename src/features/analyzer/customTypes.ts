import { evaluateFormula } from '../../lib/formulaEngine';
import type {
  AgeBand,
  LabParameter,
  LabTestDefinition,
  ParamStatus,
  PatternContext,
  PatternRule,
  Severity,
  Sex,
} from './types';

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

/** Как сравнивается число: кодом, а не знаком — знаки различаются между шрифтами. */
export type CompareOp = 'gte' | 'lte' | 'gt' | 'lt';

export type PatternNode =
  /**
   * Состояние показателя.
   *
   * `statuses` — набор допустимых состояний: «повышен **или** норма» это одно условие про один
   * показатель, а не дерево из двух. `status` при этом остаётся заполненным первым элементом, и
   * это несущее: старая сборка фронта, не знающая про набор, прочитает такое правило и покажет
   * его — пусть и уже, — вместо того чтобы упасть на неизвестном поле.
   */
  | { type: 'condition'; paramKey: string; status: ParamStatus; statuses?: ParamStatus[]; negate?: boolean }
  /**
   * Пол пациента отдельным условием.
   *
   * Норма отвечает на вопрос «нормальное ли это число» — и на него пол уже влияет через `SexRange`.
   * Правило отвечает на другой: «относится ли это заключение к этому пациенту». Ферритин ниже нормы
   * у женщины и у мужчины — разные разговоры, и без такого узла одно правило пришлось бы писать за
   * два и оба формулировать обтекаемо.
   */
  | { type: 'sex'; sex: Sex; negate?: boolean }
  /**
   * Сравнение показателя с числом: «лейкоциты ≥ 15».
   *
   * Статуса тут мало: «выше нормы» у лейкоцитов начинается с девяти, а разговор про лейкоз — с
   * пятнадцати, и одно правило на оба случая пришлось бы формулировать обтекаемо.
   */
  | { type: 'value'; paramKey: string; op: CompareOp; value: number; negate?: boolean }
  /**
   * Возраст пациента: «60 лет и старше».
   *
   * Возраст здесь ведёт себя **не так**, как в нормах, и это несущее. Норме возраст, которого нет,
   * подменяется тридцатью годами, и результат честно помечается строкой «нормы взяты для взрослого
   * 30 лет». Правилу такая подмена недопустима: «60 лет и старше» молча срабатывало бы или молча не
   * срабатывало на анализе без возраста — то есть заключение делалось бы из ничего.
   */
  | { type: 'age'; op: CompareOp; value: number; negate?: boolean }
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

/** Одна пара границ. Пустая граница — «не ограничено», а не ноль. */
export interface CustomRange {
  min?: number;
  max?: number;
}

export interface CustomAgeBand extends CustomRange {
  id: string;
  minAge?: number;
  maxAge?: number;
  /** Заполнены вместо `min`/`max`, когда у показателя включена норма по полу. */
  male?: CustomRange;
  female?: CustomRange;
}

export interface CustomLabParameter extends CustomRange {
  key: string;
  label: string;
  /** Alternative names for matching an uploaded lab file; not shown anywhere in the form. */
  aliases?: string[];
  unit?: string;
  decimals?: number;
  step?: number;
  inputType: CustomParamInputType;
  options?: CustomLabParameterOption[];
  /**
   * Норма задана отдельно для мужчин и женщин.
   *
   * Тумблер, а не отдельный вид показателя: пол и возраст — два независимых признака одной и той же
   * нормы, и включаться они могут по отдельности и вместе. Когда он включён, границы берутся из
   * `male`/`female` (у показателя или у каждого возрастного диапазона), а `min`/`max` не читаются.
   */
  bySex?: boolean;
  male?: CustomRange;
  female?: CustomRange;
  ageBands?: CustomAgeBand[];
  lowLabel?: string;
  highLabel?: string;
  lowCauses: string[];
  highCauses: string[];
  /** Present only for inputType 'derived'. No formula-editing UI — preserved verbatim on save. */
  deriveFormula?: string;
  derivedNote?: string;
}

export type PatternOperator = 'and' | 'or';

/**
 * Условие в плоском редакторе — про показатель или про самого пациента.
 *
 * Разные виды, а не одно поле с особым значением `paramKey`: показатель с таким ключом рано или
 * поздно завёл бы кто-нибудь, и различать их стало бы нечем.
 */
export type PatternCondition =
  /** Состояние показателя. Набор, а не одно: «повышен или норма» — это одно условие. */
  | { id: string; kind: 'param'; paramKey: string; statuses: ParamStatus[]; negate?: boolean }
  | { id: string; kind: 'sex'; sex: Sex; negate?: boolean }
  /** Сравнение с числом. `value` может быть пустым, пока его набирают, — тогда правило неполно. */
  | { id: string; kind: 'value'; paramKey: string; op: CompareOp; value?: number; negate?: boolean }
  | { id: string; kind: 'age'; op: CompareOp; value?: number; negate?: boolean };

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

/** Допустимые состояния условия: набор, если он задан, иначе одно. */
export function conditionStatuses(node: { status: ParamStatus; statuses?: ParamStatus[] }): ParamStatus[] {
  return node.statuses && node.statuses.length > 0 ? node.statuses : [node.status];
}

export function compare(actual: number, op: CompareOp, expected: number): boolean {
  if (op === 'gte') return actual >= expected;
  if (op === 'lte') return actual <= expected;
  if (op === 'gt') return actual > expected;
  return actual < expected;
}

function evalPatternNode(
  node: PatternNode,
  statuses: Record<string, ParamStatus>,
  values: Record<string, number>,
  context: PatternContext,
): boolean {
  if (node.type === 'condition') {
    // Незаполненный показатель не выполняет условие ни в каком виде, **в том числе с отрицанием**.
    // Иначе «гемоглобин не в норме» срабатывало на анализе, где гемоглобина нет вовсе: отсутствие
    // значения — это не состояние, и вывод о нём был бы выводом ни из чего. Для набора состояний
    // правило то же: пустоты нет ни в одном наборе.
    const actual = statuses[node.paramKey];
    if (actual === undefined) return false;
    const result = conditionStatuses(node).includes(actual);
    return node.negate ? !result : result;
  }
  if (node.type === 'sex') {
    // Пол известен всегда: на странице стоит переключатель, и по нему же берутся нормы. Поэтому
    // здесь нет ветки «не указан» — в отличие от показателя, которого может не быть в анализе.
    const result = context.sex === node.sex;
    return node.negate ? !result : result;
  }
  if (node.type === 'value') {
    // Та же причина, что у статуса: показателя нет в анализе — сравнивать нечего, и отрицание
    // этого не меняет. Производные сюда попадают наравне с прямыми: у них тоже есть число.
    const actual = values[node.paramKey];
    if (typeof actual !== 'number' || !Number.isFinite(actual)) return false;
    const result = compare(actual, node.op, node.value);
    return node.negate ? !result : result;
  }
  if (node.type === 'age') {
    // Возраста нет — условие ложно, включая отрицание. Подстановка тридцати лет, которая работает
    // для норм, здесь означала бы заключение, сделанное из ничего.
    if (context.age === undefined) return false;
    const result = compare(context.age, node.op, node.value);
    return node.negate ? !result : result;
  }
  return node.operator === 'and'
    ? node.children.every((child) => evalPatternNode(child, statuses, values, context))
    : node.children.some((child) => evalPatternNode(child, statuses, values, context));
}

/** Есть ли в правиле условие по возрасту — на любой глубине. */
export function usesAge(node: PatternNode): boolean {
  if (node.type === 'age') return true;
  return node.type === 'group' && node.children.some(usesAge);
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
      match: (statuses, values, context) => evalPatternNode(rule.root, statuses, values, context),
      usesAge: usesAge(rule.root),
    })),
  };
}

// ---------------------------------------------------------------------------
// Builder mapper — backend shape <-> draft shape.
// ---------------------------------------------------------------------------

function isSexRange(range?: BackendRangeValue): range is BackendSexRange {
  return Boolean(range && 'male' in range);
}

/**
 * Есть ли у показателя разделение по полу — хоть где-нибудь.
 *
 * «Хоть где-нибудь» важно: возрастные диапазоны могли быть заведены вразнобой — часть с полом,
 * часть без. Тумблер один на показатель, поэтому такой показатель открывается с включённым полом, а
 * диапазонам без разделения обе границы заполняются прежним общим значением. Смысл при этом не
 * меняется: «одна норма на всех» и «одинаковая норма у мужчин и женщин» — это одно и то же.
 */
function hasSexSplit(param: BackendLabParameter): boolean {
  if (param.ageBands && param.ageBands.length > 0) return param.ageBands.some((band) => isSexRange(band.range));
  return isSexRange(param.range);
}

/** Границы для мужчин и женщин из любой формы нормы: у общей они просто совпадают. */
function splitBySex(range?: BackendRangeValue): { male: CustomRange; female: CustomRange } {
  if (isSexRange(range)) return { male: { ...range.male }, female: { ...range.female } };
  const flat = { min: range?.min, max: range?.max };
  return { male: { ...flat }, female: { ...flat } };
}

/** Общие границы из любой формы нормы: у разделённой по полу берутся мужские — они стоят первыми. */
function flatten(range?: BackendRangeValue): CustomRange {
  return isSexRange(range) ? { ...range.male } : { min: range?.min, max: range?.max };
}

type LeafNode = Exclude<PatternNode, { type: 'group' }>;

/**
 * `or`-группа, которая на самом деле — одно условие с набором состояний.
 *
 * «(Лейкоциты выше нормы ИЛИ Лейкоциты в норме)» — это не дерево, а один показатель с двумя
 * допустимыми состояниями, записанный деревом за неимением другого способа. Свернув такую группу,
 * конструктор открывает правило целиком вместо того, чтобы показать замок.
 *
 * Условия жёсткие и намеренно узкие: только `or`, только условия о состоянии, только один и тот же
 * показатель, ни одного отрицания. Всё остальное — настоящее дерево, и притворяться, что мы его
 * поняли, нельзя.
 */
function foldableStatusGroup(node: PatternNode): { paramKey: string; statuses: ParamStatus[] } | null {
  if (node.type !== 'group' || node.operator !== 'or' || node.children.length === 0) return null;
  const first = node.children[0];
  if (first.type !== 'condition' || first.negate) return null;
  const statuses: ParamStatus[] = [];
  for (const child of node.children) {
    if (child.type !== 'condition' || child.negate || child.paramKey !== first.paramKey) return null;
    for (const status of conditionStatuses(child)) if (!statuses.includes(status)) statuses.push(status);
  }
  return { paramKey: first.paramKey, statuses };
}

/** Разбирается ли ребёнок группы конструктором: лист или сворачиваемая `or`-группа. */
function isEditableChild(node: PatternNode): boolean {
  return node.type !== 'group' || foldableStatusGroup(node) !== null;
}

/** Плоское — это одно условие или группа, каждый ребёнок которой разбирается конструктором. */
function isFlatPatternRoot(node: PatternNode): boolean {
  if (node.type !== 'group') return true;
  return node.children.every(isEditableChild);
}

function toDraftCondition(node: PatternNode): PatternCondition {
  const folded = foldableStatusGroup(node);
  if (folded) return { id: crypto.randomUUID(), kind: 'param', paramKey: folded.paramKey, statuses: folded.statuses };

  const leaf = node as LeafNode;
  if (leaf.type === 'sex') return { id: crypto.randomUUID(), kind: 'sex', sex: leaf.sex, negate: leaf.negate };
  if (leaf.type === 'value') {
    return { id: crypto.randomUUID(), kind: 'value', paramKey: leaf.paramKey, op: leaf.op, value: leaf.value, negate: leaf.negate };
  }
  if (leaf.type === 'age') return { id: crypto.randomUUID(), kind: 'age', op: leaf.op, value: leaf.value, negate: leaf.negate };
  return {
    id: crypto.randomUUID(),
    kind: 'param',
    paramKey: leaf.paramKey,
    statuses: conditionStatuses(leaf),
    negate: leaf.negate,
  };
}

function toLeafNode(condition: PatternCondition): PatternNode {
  if (condition.kind === 'sex') return { type: 'sex', sex: condition.sex, negate: condition.negate || undefined };
  if (condition.kind === 'value') {
    return { type: 'value', paramKey: condition.paramKey, op: condition.op, value: condition.value ?? 0, negate: condition.negate || undefined };
  }
  if (condition.kind === 'age') return { type: 'age', op: condition.op, value: condition.value ?? 0, negate: condition.negate || undefined };
  const statuses = condition.statuses.length > 0 ? condition.statuses : (['high'] as ParamStatus[]);
  return {
    type: 'condition',
    paramKey: condition.paramKey,
    // `status` заполнен всегда и первым из набора: старая сборка, не знающая про `statuses`,
    // прочитает правило и покажет его — пусть и уже, — вместо того чтобы упасть.
    status: statuses[0],
    statuses: statuses.length > 1 ? statuses : undefined,
    negate: condition.negate || undefined,
  };
}

function flattenPatternRoot(root: PatternNode): { operator: PatternOperator; conditions: PatternCondition[] } {
  if (root.type !== 'group' || foldableStatusGroup(root)) {
    return { operator: 'and', conditions: [toDraftCondition(root)] };
  }
  return { operator: root.operator, conditions: root.children.map(toDraftCondition) };
}

function buildPatternRoot(operator: PatternOperator, conditions: PatternCondition[]): PatternNode {
  return { type: 'group', operator, children: conditions.map(toLeafNode) };
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

  const bySex = hasSexSplit(param);

  if (param.ageBands && param.ageBands.length > 0) {
    return {
      ...base,
      bySex: bySex || undefined,
      ageBands: param.ageBands.map((band): CustomAgeBand => ({
        id: band.id,
        minAge: band.minAge,
        maxAge: band.maxAge,
        ...(bySex ? splitBySex(band.range) : flatten(band.range)),
      })),
    };
  }

  return { ...base, bySex: bySex || undefined, ...(bySex ? splitBySex(param.range) : flatten(param.range)) };
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

  const toRange = (source: CustomRange & { male?: CustomRange; female?: CustomRange }): BackendRangeValue =>
    param.bySex
      ? { male: { min: source.male?.min, max: source.male?.max }, female: { min: source.female?.min, max: source.female?.max } }
      : { min: source.min, max: source.max };

  if (param.ageBands && param.ageBands.length > 0) {
    return {
      ...base,
      ageBands: param.ageBands.map((band): BackendAgeBand => ({
        id: band.id,
        minAge: band.minAge,
        maxAge: band.maxAge,
        range: toRange(band),
      })),
    };
  }

  return { ...base, range: toRange(param) };
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

const STATUS_TEXT: Record<ParamStatus, string> = { low: 'ниже нормы', normal: 'в норме', high: 'выше нормы' };

export const SEX_TEXT: Record<Sex, string> = { male: 'мужской', female: 'женский' };

/** Знак сравнения для человека. Хранится код, показывается знак — см. `CompareOp`. */
const OP_TEXT: Record<CompareOp, string> = { gte: '≥', lte: '≤', gt: '>', lt: '<' };

export function describePatternNode(node: PatternNode, paramLabel: (key: string) => string): string {
  if (node.type === 'condition') {
    const states = conditionStatuses(node).map((status) => STATUS_TEXT[status]).join(' или ');
    const text = `${paramLabel(node.paramKey)} ${states}`;
    return node.negate ? `НЕ (${text})` : text;
  }
  if (node.type === 'sex') {
    const text = `пол ${SEX_TEXT[node.sex]}`;
    return node.negate ? `НЕ (${text})` : text;
  }
  if (node.type === 'value') {
    const text = `${paramLabel(node.paramKey)} ${OP_TEXT[node.op]} ${node.value}`;
    return node.negate ? `НЕ (${text})` : text;
  }
  if (node.type === 'age') {
    const text = `возраст ${OP_TEXT[node.op]} ${node.value}`;
    return node.negate ? `НЕ (${text})` : text;
  }
  const joiner = node.operator === 'and' ? ' И ' : ' ИЛИ ';
  return node.children
    .map((child) => (child.type === 'group' ? `(${describePatternNode(child, paramLabel)})` : describePatternNode(child, paramLabel)))
    .join(joiner);
}
