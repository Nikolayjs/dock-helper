import type { DispensaryOutcome, DispensaryRemovalReason } from './types';

export const OUTCOME_LABELS: Record<DispensaryOutcome, string> = {
  worsened: 'Ухудшение',
  improved: 'Улучшение',
  recovered: 'Выздоровление',
  unchanged: 'Без перемен',
  death: 'Смертность',
};

export const OUTCOME_COLORS: Record<DispensaryOutcome, string> = {
  worsened: 'red',
  improved: 'teal',
  recovered: 'brand',
  unchanged: 'gray',
  death: 'dark',
};

export const REMOVAL_REASON_LABELS: Record<DispensaryRemovalReason, string> = {
  recovered: 'Выздоровление',
  left: 'Выбыл',
};
