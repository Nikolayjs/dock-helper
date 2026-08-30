import { getParamRange } from '../analyzer/types';
import type { LabParameter, LabRange, ParamStatus } from '../analyzer/types';
import type { LabResult } from './types';

/** Точка на графике: одно значение показателя в один день, с нормой, по которой его тогда читали. */
export interface DynamicsPoint {
  resultId: string;
  /** Дата анализа — та, что стоит на бланке. */
  date: string;
  value: number;
  /**
   * Отклонение считается **по норме того самого бланка** — его пол и возраст.
   *
   * Ради этого пол и возраст и хранятся у записи: у ребёнка, сдававшего анализ три года подряд,
   * норма гемоглобина за это время меняется, и общая полоса на весь график ответила бы неверно
   * ровно на тех точках, где это важнее всего.
   */
  status: ParamStatus | null;
  range: LabRange;
}

/** Показатель, по которому есть что показать. */
export interface DynamicsOption {
  key: string;
  label: string;
  unit?: string;
  /** Сколько бланков его содержат. */
  count: number;
}

function statusOf(value: number, range: LabRange): ParamStatus {
  if (range.min !== undefined && value < range.min) return 'low';
  if (range.max !== undefined && value > range.max) return 'high';
  return 'normal';
}

/** Свежие бланки — первыми: так же, как они стоят списком в карточке пациента. */
function byDateDesc(a: LabResult, b: LabResult): number {
  return b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt);
}

/**
 * Показатели, по которым имеет смысл строить динамику.
 *
 * Порог — **два бланка**: одна точка это не динамика, а то же самое число, которое уже показано в
 * самой записи. Предлагать её в списке значило бы обещать график там, где графика нет.
 *
 * Название берётся из самого свежего бланка, где показатель встретился: показатель могли
 * переименовать, и врач ищет его по тому слову, которым зовёт сегодня.
 */
export function dynamicsOptions(results: LabResult[]): DynamicsOption[] {
  const seen = new Map<string, DynamicsOption>();

  for (const result of [...results].sort(byDateDesc)) {
    for (const entry of result.values) {
      const known = seen.get(entry.key);
      if (known) known.count += 1;
      else seen.set(entry.key, { key: entry.key, label: entry.label, unit: entry.unit, count: 1 });
    }
  }

  return [...seen.values()]
    .filter((option) => option.count >= 2)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ru'));
}

/**
 * Значения одного показателя по бланкам — по возрастанию даты.
 *
 * Список бланков в карточке идёт свежими вверх, а график читается слева направо во времени: это
 * разный порядок, и путать их нельзя. Бланки без этого показателя выпадают: пропуск в ряду —
 * это «не сдавали», а не ноль.
 *
 * `param` — описание показателя в **сегодняшнем** анализаторе. Его может не быть вовсе (анализатор
 * удалили или показатель из него убрали); тогда точки остаются, а отклонение не считается: числа
 * никуда не делись, а нормы, по которой их судить, больше нет.
 */
export function dynamicsSeries(results: LabResult[], key: string, param?: LabParameter): DynamicsPoint[] {
  const points: DynamicsPoint[] = [];

  for (const result of results) {
    const entry = result.values.find((item) => item.key === key);
    if (!entry) continue;

    const range = param ? getParamRange(param, result.sex, result.ageYears ?? undefined) : {};
    const hasRange = range.min !== undefined || range.max !== undefined;
    points.push({
      resultId: result.id,
      date: result.takenAt,
      value: entry.value,
      status: param && hasRange ? statusOf(entry.value, range) : null,
      range,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Полоса нормы для графика.
 *
 * Берётся из **самого свежего** бланка: график показывает, куда идёт показатель сейчас, и мерить
 * его прошлогодней детской нормой было бы неверно. Точная норма каждой точки при этом не теряется —
 * она у самой точки, и по ней покрашена её строка в таблице под графиком.
 */
export function latestRange(points: DynamicsPoint[]): LabRange {
  return points.length > 0 ? points[points.length - 1].range : {};
}
