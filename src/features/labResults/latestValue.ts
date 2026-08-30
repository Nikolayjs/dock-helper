import type { LabResult } from './types';

/** Значение показателя из самого свежего бланка, где оно есть. */
export interface LatestValue {
  value: number;
  unit?: string;
  label: string;
  /** Дата бланка — без неё число ничего не значит: креатинин годовой давности не про сегодня. */
  takenAt: string;
  resultId: string;
  patientId: string;
}

/**
 * Последнее значение показателя, найденного **по имени**, а не по ключу.
 *
 * Ключ показателя принадлежит анализатору, а анализатор — запись врача: свой бланк биохимии он
 * заводит с любыми ключами, и `creatinine` в нём может называться как угодно. Имя же врач пишет
 * так, как оно напечатано в лаборатории, — по нему и ищем.
 *
 * Второго места для этого числа нет и не будет: креатинин — лабораторное значение, и держать его
 * ещё и полем карточки значило бы завести два источника, которые разойдутся. Хуже того, поле в
 * карточке не стареет заметно: число без даты, введённое год назад, точно так же уйдёт в расчёт
 * клиренса, и ошибка выйдет не в карточке, а в назначении.
 */
export function latestValueByName(results: LabResult[], pattern: RegExp): LatestValue | undefined {
  let best: LatestValue | undefined;
  // Время записи держится отдельно: в самом значении его нет, а сравнивать надо именно бланки.
  let bestCreatedAt = '';

  for (const result of results) {
    for (const entry of result.values) {
      if (!pattern.test(entry.label) && !pattern.test(entry.key)) continue;
      // Свежий бланк выигрывает; при совпадении дат — тот, что записан позже.
      const older =
        best !== undefined &&
        (result.takenAt < best.takenAt || (result.takenAt === best.takenAt && result.createdAt < bestCreatedAt));
      if (older) continue;
      best = {
        value: entry.value,
        unit: entry.unit,
        label: entry.label,
        takenAt: result.takenAt,
        resultId: result.id,
        patientId: result.patientId,
      };
      bestCreatedAt = result.createdAt;
    }
  }

  return best;
}

/** Креатинин: то, без чего не считается ни клиренс, ни СКФ. */
export const CREATININE = /креатинин|creatinine/i;
