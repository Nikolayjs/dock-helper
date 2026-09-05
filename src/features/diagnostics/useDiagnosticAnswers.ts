import { useCallback, useMemo, useState } from 'react';

import type { Answer } from './diagnosticEngine';

export interface DiagnosticAnswers {
  answers: Record<string, Answer>;
  /** Признаки, о которых врач сказал «не знаю»: опрос их больше не задаёт. */
  skipped: Set<string>;
  setAnswer: (symptomId: string, answer: Answer | null) => void;
  skip: (symptomId: string) => void;
  reset: () => void;
  /** Признаки, по которым что-то сказано, — и отмеченные, и пропущенные. */
  touched: Set<string>;
  answeredCount: number;
}

/**
 * Состояние одного разбора: что про признаки сказал врач.
 *
 * **Оно одно на обе вкладки, и это несущее решение.** «Опрос» и «Выбор симптомов» — два вида на
 * один и тот же разбор, а не два инструмента: врач отмечает то, что видит перед собой, переходит в
 * опрос и добирает недостающее вопросами, возвращается и правит. Раздельное состояние означало бы,
 * что дифференциальный ряд на соседних вкладках разный, — то есть одна и та же панель отвечает на
 * один и тот же случай двумя способами, и какой из них настоящий, не видно.
 *
 * Отсюда же и то, что отмеченное в списке опрос больше не спрашивает: признак, о котором уже
 * сказано, — это ответ, а не пропуск, каким бы путём он ни был дан.
 */
export function useDiagnosticAnswers(): DiagnosticAnswers {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const setAnswer = useCallback((symptomId: string, answer: Answer | null) => {
    setAnswers((prev) => {
      if (answer === null) {
        if (!(symptomId in prev)) return prev;
        const next = { ...prev };
        delete next[symptomId];
        return next;
      }
      if (prev[symptomId] === answer) return prev;
      return { ...prev, [symptomId]: answer };
    });
    // Снятая отметка возвращает признак в опрос: врач передумал, а не отказался отвечать.
    setSkipped((prev) => {
      if (!prev.has(symptomId)) return prev;
      const next = new Set(prev);
      next.delete(symptomId);
      return next;
    });
  }, []);

  const skip = useCallback((symptomId: string) => {
    setSkipped((prev) => (prev.has(symptomId) ? prev : new Set(prev).add(symptomId)));
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
    setSkipped(new Set());
  }, []);

  const touched = useMemo(() => new Set([...Object.keys(answers), ...skipped]), [answers, skipped]);

  return { answers, skipped, setAnswer, skip, reset, touched, answeredCount: Object.keys(answers).length };
}
