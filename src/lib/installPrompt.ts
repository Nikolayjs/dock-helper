/**
 * Установка приложения на устройство.
 *
 * Само по себе приложение установить можно и без нас — Chrome показывает свой значок в адресной
 * строке. Но значок этот замечают немногие, а на iPhone его нет вовсе: там установка делается
 * руками через «Поделиться», и **без неё не работают push-уведомления**. Поэтому приложение говорит
 * об установке само, и на каждой системе — по-своему.
 */

/** Событие, которым Chrome сообщает, что установка возможна. В типах браузера его нет. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

/**
 * Перехват события — ставится при старте, до отрисовки.
 *
 * Событие приходит один раз и вскоре после загрузки: подписавшись из компонента, который
 * смонтируется позже, его можно не застать вовсе. Поэтому слушатель ставится в точке входа, а
 * компоненты читают уже сохранённое.
 */
export function listenForInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Без этого Chrome показывает свою полоску снизу — и наша кнопка оказывается второй об одном.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function subscribeToInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canInstall(): boolean {
  return deferred !== null;
}

/** Приложение уже открыто как установленное. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Свой признак у Safari на iOS: стандартного `display-mode` он долго не поддерживал.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * iPhone и iPad: там установка только вручную, и рассказать про неё больше некому.
 *
 * Второе условие — про iPad. С iPadOS 13 он представляется Макинтошем, и по одному имени его не
 * отличить; выдаёт сенсорный экран, которого у настоящего Мака нет. Ошибиться тут значит показать
 * владельцу планшета совет «нажмите значок в адресной строке Chrome», которого там не будет.
 */
export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** Что показать в карточке установки. */
export type InstallAdvice = 'installed' | 'button' | 'ios' | 'other';

/**
 * Умеет ли этот браузер поставить приложение **отдельным приложением**, а не ярлыком.
 *
 * На Android настоящую установку делает только Chrome: он собирает WebAPK, и приложение получает
 * своё окно без адресной строки и свою строку в списке приложений. Остальные браузеры на том же
 * Chromium — Яндекс.Браузер, Opera, Samsung Internet — кладут на экран **ярлык**, который
 * открывается вкладкой внутри них же. Со стороны сайта это не чинится ничем: манифест у всех один
 * и тот же, разница в браузере.
 *
 * Поэтому единственное честное, что можно сделать, — сказать об этом заранее, а не оставлять врача
 * гадать, почему «установленное» приложение открывается вкладкой.
 */
export function makesShortcutOnly(userAgent: string): boolean {
  if (!/android/i.test(userAgent)) return false;
  // Яндекс, Opera, Samsung, Edge, Firefox — все зовут себя Chrome, кроме последнего; отличают их
  // собственные метки, и проверять надо именно их наличие, а не отсутствие слова Chrome.
  return /YaBrowser|OPR\/|SamsungBrowser|EdgA|Firefox|MiuiBrowser|HuaweiBrowser/i.test(userAgent);
}

/**
 * Порядок веток здесь и есть решение, и он проверяется тестом, а не браузером.
 *
 * Установленному приложению нечего предлагать — эта ветка первая. Затем кнопка: там, где браузер
 * сам сказал, что установка возможна, инструкция была бы длиннее и хуже. И только потом разговор о
 * том, чего браузер не умеет: на iOS событие не приходит **никогда**, поэтому туда попадают ровно
 * те, кому нужна инструкция.
 */
export function installAdvice(state: { standalone: boolean; installable: boolean; ios: boolean }): InstallAdvice {
  if (state.standalone) return 'installed';
  if (state.installable) return 'button';
  return state.ios ? 'ios' : 'other';
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const event = deferred;
  // Событие одноразовое: второй `prompt()` браузер отвергает. Отпускаем его сразу.
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
