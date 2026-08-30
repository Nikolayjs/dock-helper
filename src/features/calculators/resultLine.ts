import type { CalculatorDefinition, InterpretationRange } from './types';
import { withUnit } from './units';

/** Числа в записи — с запятой: это строка для чтения, а не для разбора. */
function ru(value: number): string {
  return String(value).replace('.', ',');
}

/**
 * Строка о расчёте — та, что уходит в заметку визита.
 *
 * Вместе с результатом в неё идут **исходные значения**, и это главное здесь: «клиренс 62» через
 * полгода не проверить ничем, а «клиренс 62 при весе 78,5 и креатинине 118» — можно, и видно, что
 * считали не по сегодняшнему весу. Ровно то же врач написал бы рукой.
 *
 * У полей-списков печатается подпись варианта, а не его число: множитель `1,04` в записи визита не
 * значит ничего.
 */
export function calculationSummary(
  definition: CalculatorDefinition,
  values: Record<string, number | ''>,
  result: number,
  interpretation?: InterpretationRange,
): string {
  const parts: string[] = [];

  for (const field of definition.fields) {
    const value = values[field.key];
    if (value === '' || value === undefined) continue;
    if (field.type === 'select') {
      const option = field.options?.find((candidate) => candidate.value === value);
      if (option) parts.push(`${field.label.toLowerCase()} ${option.label.toLowerCase()}`);
      continue;
    }
    parts.push(`${field.label.toLowerCase()} ${withUnit(value, field.unit)}`);
  }

  const head = `${definition.resultLabel}: ${ru(Number(result.toFixed(definition.decimals)))}${
    definition.resultUnit ? ` ${definition.resultUnit}` : ''
  }`;
  const verdict = interpretation ? ` — ${interpretation.label}` : '';
  const inputs = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  return `${head}${verdict}${inputs}.`;
}

/** Дописывает строку к заметке визита, не затирая написанное. */
export function appendToNote(note: string, line: string): string {
  return note.trim() ? `${note.trim()}\n${line}` : line;
}
