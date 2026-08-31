import { readSetting, writeSetting } from '../../lib/settingsStore';

/**
 * Что из уведомлений врач уже видел.
 *
 * Бейдж на колокольчике показывал, что на сегодня **что-то есть**, — и не гас никогда: пункт
 * чек-листа и заметка живут весь день, а красная точка означала не «новое», а «сегодня не пусто».
 * Значок, который горит всегда, перестаёт что-либо сообщать.
 *
 * Хранится список **идентификаторов**, а не время последнего открытия: заметка, добавленная через
 * час после того, как список был просмотрен, обязана зажечь бейдж снова, а по времени её от уже
 * прочитанных не отличить.
 *
 * Список **обрезается по сегодняшнему набору** при каждой записи. Иначе он рос бы вечно — по
 * несколько строк в день, — а синхронизация настроек не принимает значения длиннее 32 КБ: молча
 * перестать синхронизироваться хуже, чем не хранить лишнего. Вчерашние пункты в наборе не
 * появляются, значит и помнить о них нечего.
 */
const KEY = 'medassist:notifications-seen';

export function readSeen(): string[] {
  const raw = readSetting(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Отмечает как просмотренное ровно то, что показано сейчас. */
export function markSeen(currentIds: string[]): void {
  writeSetting(KEY, JSON.stringify(currentIds));
}

/** Есть ли среди сегодняшних уведомлений хоть одно, которого врач ещё не видел. */
export function countUnseen(currentIds: string[], seen: string[]): number {
  const known = new Set(seen);
  return currentIds.filter((id) => !known.has(id)).length;
}
