import { request } from './httpRepository';

/**
 * Личные настройки: одно хранилище на все устройства врача.
 *
 * До этого раскладка дашборда, порядок меню, сортировки и зум читалки лежали в `localStorage`, то
 * есть принадлежали **браузеру**, а не человеку: настроив дашборд на работе, дома врач получал его
 * заново — и это выглядело как потеря настройки, а не как задумка.
 *
 * Читается по-прежнему из `localStorage`, и это важно: настройка нужна **в первом же кадре**, до
 * любого запроса, иначе дашборд успел бы отрисоваться в порядке по умолчанию и переложиться на
 * глазах. Сервер здесь не источник, а вторая копия: при входе она вливается в локальную, дальше
 * правки уходят на сервер пачкой.
 */

/** Ключи, которые синхронизируются. Список явный — см. `LOCAL_ONLY` про то, почему не все. */
export const SYNCED_KEYS = [
  'medassist:dashboard-layout',
  'medassist:sidebar-order',
  'medassist:sidebar-width',
  'medassist:library:reader-prefs',
  'medassist:appearance',
  'medassist:document-usage',
  'medassist:drugs:intro-hidden',
  'medassist:patients-disclaimer-dismissed',
  'medassist:notifications-seen',
  // «Первые шаги пройдены» — про человека, а не про браузер: встречать его вопросами о
  // специальности на втором устройстве незачем.
  'medassist:onboarding',
  // Через сколько минут без действий закрывать экран — решение врача о своей работе, а не о
  // конкретном браузере: на рабочем компьютере в ординаторской оно нужно ровно так же, как дома.
  'medassist:idle-lock-minutes',
] as const;

/** Сортировки списков: ключей столько же, сколько разделов, и все они синхронизируются. */
export const SORT_KEY_PREFIX = 'medassist:sort:';

/**
 * Что остаётся на устройстве — и почему.
 *
 * `auth-token` — ключ от аккаунта, ему на сервере делать нечего. Демо-сессия живёт во вкладке и
 * обещает, что ничего не сохраняется. Отметка о перезагрузке после деплоя — одноразовая защита от
 * зацикливания, общая на устройства она сделала бы вторую перезагрузку невозможной там, где она
 * как раз нужна. Отметка о засеве лент — про то, что этот браузер уже заводил ленты по умолчанию.
 */
const LOCAL_ONLY = [
  'medassist:auth-token',
  'medassist:demo',
  'medassist:demo-data',
  'medassist:stale-chunk-reload',
  'medassist:news-sources:seeded-defaults-v3',
];

/**
 * Потолок значения, за которым настройка остаётся на устройстве.
 *
 * Ровно один случай: обои со своей фотографией. Картинка лежит строкой `data:` и весит сотни
 * килобайт — возить её на каждом входе значило бы синхронизировать не настройку, а файл. Правило
 * одно на все ключи, без исключения именно для обоев: так его не придётся вспоминать, когда
 * появится следующая тяжёлая настройка.
 */
export const MAX_SYNCED_LENGTH = 32_000;

export function isSyncedKey(key: string): boolean {
  if (LOCAL_ONLY.includes(key)) return false;
  return key.startsWith(SORT_KEY_PREFIX) || (SYNCED_KEYS as readonly string[]).includes(key);
}

/** Синхронизируется ли **это** значение: длинное остаётся на устройстве. */
export function isSyncable(key: string, value: string): boolean {
  return isSyncedKey(key) && value.length <= MAX_SYNCED_LENGTH;
}

/** `localStorage` бросает в приватном окне и при запрете на хранение — настройка не повод падать. */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

export function readSetting(key: string): string | null {
  return safely(() => localStorage.getItem(key), null);
}

let pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let pushEnabled = false;

/**
 * Отправка накопленного.
 *
 * Пачкой и с задержкой: перетаскивание карточки дашборда меняет раскладку на каждое отпускание, а
 * ограничитель — 20 запросов в минуту. Полторы секунды покрывают серию правок и не заметны.
 */
function schedulePush(): void {
  if (!pushEnabled || pending.size === 0) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const items = [...pending].map(([key, value]) => ({ key, value }));
    pending = new Map();
    // Сорвавшаяся отправка не должна ничего ломать: локально настройка уже сохранена, а на сервер
    // уедет со следующей правкой.
    void request('/user-settings', { method: 'PUT', body: JSON.stringify({ items }) }).catch(() => undefined);
  }, 1500);
}

/**
 * Отправить накопленное **сейчас**, не дожидаясь полутора секунд.
 *
 * Нужно там, где следом идёт перезагрузка страницы: на входе серверная копия выигрывает, и правка,
 * не успевшая уехать, откатывается. Поймано пробой — окно первых шагов, закрытое и тут же
 * перезагруженное, открывалось снова: локально стояло «done», а с сервера приезжало «pending».
 */
export function flushSettings(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pushEnabled || pending.size === 0) return;
  const items = [...pending].map(([key, value]) => ({ key, value }));
  pending = new Map();
  // `keepalive` — на случай, если страница уходит прямо сейчас: обычный запрос браузер оборвёт.
  void request('/user-settings', { method: 'PUT', body: JSON.stringify({ items }), keepalive: true }).catch(() => undefined);
}

export function writeSetting(key: string, value: string): void {
  safely(() => localStorage.setItem(key, value), undefined);
  if (!isSyncable(key, value)) return;
  pending.set(key, value);
  schedulePush();
}

export function removeSetting(key: string): void {
  safely(() => localStorage.removeItem(key), undefined);
  if (!isSyncedKey(key)) return;
  // Пустое значение на сервере означает удаление: сброшенная настройка обязана сброситься везде.
  pending.set(key, '');
  schedulePush();
}

/**
 * Слить настройки с сервера в это устройство. Зовётся один раз, после входа.
 *
 * **Серверная копия выигрывает**, и это осознанный выбор, а не небрежность: она общая, а локальная
 * принадлежит одному браузеру. Правки уходят на сервер через полторы секунды, поэтому окно, в
 * котором можно потерять сделанное, — эти самые полторы секунды плюс время недоступности сети.
 * Правило «последний записавший прав» проще любого слияния и предсказуемо объяснимо врачу.
 */
export async function pullSettings(): Promise<{ applied: number; seeded: number }> {
  let applied = 0;
  let seeded = 0;
  try {
    const remote = await request<Record<string, string>>('/user-settings');
    const known = remote ?? {};

    for (const [key, value] of Object.entries(known)) {
      if (!isSyncedKey(key) || typeof value !== 'string') continue;
      safely(() => localStorage.setItem(key, value), undefined);
      applied++;
    }

    /*
     * Чего на сервере нет, а на устройстве есть, — поднимаем туда.
     *
     * Без этого настройки, сделанные до появления синхронизации, не уехали бы никуда, пока их не
     * тронут: врач, годами настраивавший дашборд, на втором устройстве увидел бы пустое место и
     * решил бы, что синхронизация не работает. Поднимается только то, чего на сервере ещё нет, —
     * серверную копию это не перетирает.
     */
    pushEnabled = true;
    for (const key of localKeys()) {
      if (key in known) continue;
      const value = readSetting(key);
      if (value === null || !isSyncable(key, value)) continue;
      pending.set(key, value);
      seeded++;
    }
    schedulePush();
  } catch {
    // Нет сети или сервер молчит — работаем на локальных настройках, как раньше.
    pushEnabled = true;
  }
  return { applied, seeded };
}

/** Ключи настроек, которые уже лежат в этом браузере. */
function localKeys(): string[] {
  return safely(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isSyncedKey(key)) keys.push(key);
    }
    return keys;
  }, []);
}

/** Выключает отправку — на выходе из аккаунта и в демо, где сервера нет вовсе. */
export function stopSettingsSync(): void {
  pushEnabled = false;
  pending = new Map();
  if (timer) clearTimeout(timer);
  timer = null;
}
