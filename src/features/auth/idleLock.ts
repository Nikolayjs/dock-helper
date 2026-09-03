import { readSetting, writeSetting } from '../../lib/settingsStore';

/**
 * Блокировка по бездействию.
 *
 * Приложение открыто на общем компьютере в ординаторской, и вкладка с картотекой пациентов
 * остаётся живой ровно столько, сколько живёт токен. Срок токена сокращён до двенадцати часов, но
 * двенадцать часов — это всё равно смена и ещё половина следующей.
 *
 * Поэтому после N минут без единого действия экран закрывается, и чтобы вернуться, нужен пароль.
 * **Данные из кэша при этом не показываются**: заслонка рисуется поверх всего, а не вместо
 * содержимого — иначе закрытая вкладка успевала бы отдать содержимое тому, кто мимо проходил.
 *
 * Блокировка **не** гасит сессию: токен остаётся, кэш React Query остаётся, врач вводит пароль и
 * продолжает с того же места. Разлогинить — значит перезагрузить приложение и потерять
 * несохранённое; это другое действие, и оно рядом кнопкой «Выйти».
 */

const KEY = 'medassist:idle-lock-minutes';

/** Значения на выбор в профиле. Ноль — «не блокировать». */
export const IDLE_LOCK_CHOICES = [0, 5, 15, 30, 60] as const;

export const DEFAULT_IDLE_MINUTES = 15;

/**
 * Читается синхронно, при первом рендере: заслонка обязана появиться до содержимого, а не после
 * ответа сервера. Настройка синхронизируется между устройствами (`SYNCED_KEYS`) — она про врача,
 * а не про браузер.
 */
export function readIdleMinutes(): number {
  const raw = readSetting(KEY);
  if (raw === null) return DEFAULT_IDLE_MINUTES;
  const value = Number(raw);
  return (IDLE_LOCK_CHOICES as readonly number[]).includes(value) ? value : DEFAULT_IDLE_MINUTES;
}

export function writeIdleMinutes(minutes: number): void {
  writeSetting(KEY, String(minutes));
}

/** Подпись для профиля; ноль называется словами, а не «0 минут». */
export function idleLockLabel(minutes: number): string {
  if (minutes === 0) return 'Не блокировать';
  if (minutes === 60) return 'Через час';
  return `Через ${minutes} мин`;
}

/**
 * Пора ли закрывать экран.
 *
 * Сравниваются **часы**, а не сумма тиков таймера: ноутбук, закрытый на полтора часа, разбудит уже
 * заблокированное приложение, хотя таймеры всё это время не шли. Ноль — «не блокировать», и это
 * настоящее значение настройки, а не «не задано».
 */
export function isIdleFor(lastActivityAt: number, now: number, minutes: number): boolean {
  if (minutes <= 0) return false;
  return now - lastActivityAt >= minutes * 60_000;
}

/** Действия врача, после которых отсчёт начинается заново. `scroll` намеренно есть: чтение — работа. */
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
