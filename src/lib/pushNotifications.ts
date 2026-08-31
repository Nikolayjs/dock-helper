import { request } from './httpRepository';

/**
 * Push-уведомления: подписка устройства и её снятие.
 *
 * Нужны потому, что до них напоминание сработать не могло: его ждал опрос списка раз в пятнадцать
 * секунд в **открытой вкладке**, то есть функция работала ровно тогда, когда врач и так смотрит в
 * экран. Push доставляется браузером и при закрытом приложении — этим он и отличается.
 */

/** В каком состоянии уведомления на этом устройстве. */
export type PushState =
  /** Браузер не умеет push вовсе — старый или урезанный (частное окно, встроенный просмотрщик). */
  | { kind: 'unsupported' }
  /** Сервер не настроен: ключа для подписки нет, и переключатель показывать нечестно. */
  | { kind: 'notConfigured' }
  /** Разрешение отозвано в настройках браузера — из приложения его не вернуть. */
  | { kind: 'blocked' }
  | { kind: 'off' }
  | { kind: 'on' };

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Регистрация service worker.
 *
 * Только в собранном приложении: в режиме разработки файлы отдаёт Vite, и обработчик, кэширующий
 * `/assets/`, стал бы кэшировать то, что меняется на каждом сохранении.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported() || import.meta.env.DEV) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // Отсутствие service worker не должно мешать работать: приложение и без него полное.
    return null;
  }
}

/** Ключ сервера. `null` — push здесь не настроен. */
export async function fetchPublicKey(): Promise<string | null> {
  const { publicKey } = await request<{ publicKey: string | null }>('/push/public-key');
  return publicKey;
}

/**
 * Ключ VAPID приходит строкой base64url, а `subscribe` принимает байты.
 *
 * Буфер создаётся явно: типы `Uint8Array` в свежем TypeScript помнят, на каком буфере он лежит, а
 * `applicationServerKey` принимает только обычный `ArrayBuffer` — не разделяемый.
 */
function toBytes(base64Url: string): ArrayBuffer {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return buffer;
}

export async function getPushState(publicKey: string | null): Promise<PushState> {
  if (!isPushSupported()) return { kind: 'unsupported' };
  if (!publicKey) return { kind: 'notConfigured' };
  if (Notification.permission === 'denied') return { kind: 'blocked' };

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? { kind: 'on' } : { kind: 'off' };
}

/**
 * Подписка этого устройства.
 *
 * Часовой пояс уезжает на сервер вместе с подпиской: время напоминания хранится настенными часами
 * без пояса, а сервер живёт в UTC — без пояса «девять утра» ушло бы в девять по Гринвичу.
 */
export async function subscribeToPush(publicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Разрешение на уведомления не выдано');

  const registration = (await navigator.serviceWorker.getRegistration()) ?? (await registerServiceWorker());
  if (!registration) throw new Error('Не удалось подготовить фоновый обработчик уведомлений');
  // Дожидаемся, пока обработчик станет действующим: подписаться через «устанавливающийся» нельзя.
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Без этого браузеры не подписывают вовсе: обещание, что каждый push будет показан человеку.
      userVisibleOnly: true,
      applicationServerKey: toBytes(publicKey),
    }));

  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  await request('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      userAgent: navigator.userAgent.slice(0, 300),
    }),
  });
}

/** Отписка. Снимается и в браузере, и на сервере: запись без подписки получала бы отказ вечно. */
export async function unsubscribeFromPush(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await request('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
}
