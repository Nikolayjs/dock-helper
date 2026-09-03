import type { PatternCondition } from '../customTypes';

/**
 * Условие, из которого ничего не следует: пустой набор состояний или число, которое не набрали.
 *
 * Помечается так же, как пустое заключение, и по той же причине: правило с таким условием либо не
 * сработает никогда, либо сработает не на том — и заметить это по результату нельзя.
 *
 * Живёт отдельным файлом, а не рядом со строкой редактора: её читают и строка (чтобы пометить себя
 * незаполненной), и страница (чтобы не дать сохранить), а файл с компонентом, экспортирующий ещё и
 * функции, ломает горячую перезагрузку.
 */
export function incomplete(condition: PatternCondition): boolean {
  if (condition.kind === 'param') return condition.statuses.length === 0;
  if (condition.kind === 'value' || condition.kind === 'age') return condition.value === undefined;
  return false;
}
