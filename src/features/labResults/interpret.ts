import { analyzeTest } from '../analyzer/analyzerEngine';
import type { AnalysisResult } from '../analyzer/analyzerEngine';
import type { LabTestDefinition } from '../analyzer/types';
import type { LabResult } from './types';

export interface InterpretedResult {
  /** Анализатор, которым бланк разбирается **сегодня**, — или ничего, если его удалили. */
  test?: LabTestDefinition;
  /** Заключения и отклонения. Нет анализатора — нет и толкования: числа остаются, судить их нечем. */
  analysis?: AnalysisResult;
}

/** Значения бланка в том виде, в каком их принимает движок: ключ показателя → число. */
export function resultValueMap(result: LabResult): Record<string, number> {
  return Object.fromEntries(result.values.map((entry) => [entry.key, entry.value]));
}

/**
 * Толкование сохранённого бланка — по **сегодняшнему** анализатору, а не по снимку.
 *
 * Нормы и правила это ровно то, что врач исправляет: замороженное в записи заключение осталось бы
 * неверным навсегда, и конструктор анализаторов чинил бы только будущие анализы. Пол и возраст при
 * этом берутся из самой записи — они часть того, как бланк был прочитан, и в карточке пациента
 * могли с тех пор измениться (возраст меняется сам).
 */
export function interpretResult(result: LabResult, tests: LabTestDefinition[]): InterpretedResult {
  const test = tests.find((item) => item.id === result.analyzerId);
  if (!test) return {};
  return {
    test,
    analysis: analyzeTest(test, resultValueMap(result), result.sex, result.ageYears ?? undefined),
  };
}
