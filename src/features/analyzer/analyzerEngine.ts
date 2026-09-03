import { DEFAULT_ADULT_AGE, getParamRange, hasAgeBands, isAgeWithinBands } from './types';
import type { LabParameter, LabTestDefinition, ParamStatus, PatternRule, Sex } from './types';

export interface ParamDeviation {
  param: LabParameter;
  status: ParamStatus;
  value: number;
  range: { min?: number; max?: number };
}

export interface AnalysisResult {
  statuses: Record<string, ParamStatus>;
  values: Record<string, number>;
  deviations: ParamDeviation[];
  matchedPatterns: PatternRule[];
  enteredCount: number;
  /**
   * Чем нормы отличаются от заявленных, если отличаются.
   *
   * Показывается врачу. Норма, взятая не для того возраста, — это неверный ответ, который выглядит
   * как верный: у ребёнка и у взрослого расходятся и гемоглобин, и лейкоциты, и щелочная фосфатаза.
   */
  ageNote?: { kind: 'assumed'; assumedAge: number } | { kind: 'outside'; age: number };
  /**
   * В анализе есть правила, спрашивающие про возраст, а возраст не введён.
   *
   * Такие правила не срабатывают никогда, и без этой строки пропавшее заключение выглядело бы как
   * отсутствие находки. Отдельно от `ageNote`: тот про **нормы**, взятые для подставленного
   * возраста, а здесь ничего не подставляется вовсе.
   */
  ageMissingForPatterns?: boolean;
}

function getStatus(value: number, range: { min?: number; max?: number }): ParamStatus {
  if (range.min !== undefined && value < range.min) return 'low';
  if (range.max !== undefined && value > range.max) return 'high';
  return 'normal';
}

export function analyzeTest(
  test: LabTestDefinition,
  values: Record<string, number | undefined>,
  sex: Sex,
  age?: number,
): AnalysisResult {
  const statuses: Record<string, ParamStatus> = {};
  const deviations: ParamDeviation[] = [];
  const numericValues: Record<string, number> = {};
  let enteredCount = 0;

  const evaluate = (param: LabParameter, value: number | undefined) => {
    // Бесконечность — не число, и судить её нормой нечем. Производный показатель с делением на
    // ноль давал именно её: значение проходило в отклонения со словом «Повышен», а печаталось
    // пустой строкой — карточка с названием, единицей измерения и без числа. Правила-паттерны при
    // этом срабатывали, то есть заключение строилось на том, чего нет.
    if (value === undefined || !Number.isFinite(value)) return;
    numericValues[param.key] = value;
    const range = getParamRange(param, sex, age);
    const status = getStatus(value, range);
    statuses[param.key] = status;
    if (status !== 'normal') deviations.push({ param, status, value, range });
  };

  for (const param of test.parameters) {
    if (param.inputType === 'derived') continue;
    const value = values[param.key];
    if (value === undefined || !Number.isFinite(value)) continue;
    enteredCount++;
    evaluate(param, value);
  }

  // Производные считаются после прямых — и по кругу, пока появляются новые значения.
  //
  // Одного прохода мало: производное от производного посчиталось бы, только если стоит в списке
  // ниже своего источника, и молча не посчиталось бы иначе. Кругов не больше, чем параметров, —
  // на взаимной ссылке двух показателей друг на друга это останавливается, а не висит.
  const derived = test.parameters.filter((param) => param.inputType === 'derived' && param.derive);
  for (let round = 0; round < derived.length; round++) {
    const before = Object.keys(numericValues).length;
    for (const param of derived) {
      if (param.key in numericValues) continue;
      evaluate(param, param.derive!(numericValues));
    }
    if (Object.keys(numericValues).length === before) break;
  }

  const matchedPatterns = test.patterns.filter((pattern) => pattern.match(statuses, numericValues, { sex, age }));

  // О подстановке говорится только тогда, когда она на что-то влияет: если ни один заполненный
  // показатель не зависит от возраста, сообщение было бы шумом.
  const ageDependent = test.parameters.filter((param) => hasAgeBands(param) && param.key in numericValues);
  const ageNote: AnalysisResult['ageNote'] =
    ageDependent.length === 0
      ? undefined
      : age === undefined
        ? { kind: 'assumed', assumedAge: DEFAULT_ADULT_AGE }
        : ageDependent.every((param) => isAgeWithinBands(param, age))
          ? undefined
          : { kind: 'outside', age };

  return {
    statuses,
    values: numericValues,
    deviations,
    matchedPatterns,
    enteredCount,
    ageNote,
    // Говорится, только когда такие правила в анализе действительно есть: иначе это был бы шум на
    // каждом анализе, где врач не ввёл возраст, — то есть на большинстве.
    ageMissingForPatterns: age === undefined && test.patterns.some((pattern) => pattern.usesAge) ? true : undefined,
  };
}
