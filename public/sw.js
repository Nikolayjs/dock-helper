/*
 * Service worker приложения.
 *
 * Он здесь ради двух вещей — push-уведомлений и установки на устройство, — и **нарочно не кэширует
 * данные**. Офлайновая копия записей пациентов выглядела бы как обычный экран, но показывала бы
 * вчерашнее: врач принимал бы решение по устаревшим анализам, не зная об этом. Из всего кэшируются
 * только файлы сборки: их имена содержат отпечаток содержимого, поэтому файл с таким именем — это
 * в точности тот же файл, и устареть он не может.
 *
 * `index.html` не кэшируется никогда: он называет имена файлов сборки, и, законсервировав его, мы
 * законсервировали бы всю версию приложения.
 */
const CACHE = 'medassist-assets-v1';

self.addEventListener('install', (event) => {
  // Новая версия начинает работать сразу: держать её «ожидающей» до закрытия всех вкладок значит
  // оставлять врача на старом обработчике push после деплоя.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Всё, кроме файлов сборки, идёт в сеть без нашего участия: и запросы к API, и index.html.
  if (!url.pathname.startsWith('/assets/')) return;

  /*
   * Ответ обязан прийти даже тогда, когда кэш не работает.
   *
   * Это исправленная ошибка, и она была тяжёлой: любой сбой внутри обработчика превращается в
   * `ERR_FAILED` у файла сборки, а без файлов сборки приложение не стартует вовсе — врач видит
   * пустой экран, и починить это со своей стороны он не может никак. Кэш здесь — ускорение, и
   * ускорение не имеет права ломать то, что ускоряет: каждый шаг обёрнут, а на самый крайний
   * случай остаётся простой поход в сеть.
   */
  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(request);
        if (cached) return cached;
      } catch {
        // Кэш недоступен (приватное окно, запрет на хранение, нехватка места) — идём в сеть.
      }

      const response = await fetch(request);
      try {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
      } catch {
        // Не записалось — переживём: файл уже получен и отдаётся странице.
      }
      return response;
    })().catch(() => fetch(request)),
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'MedAssist', body: 'Напоминание', url: '/app/calendar', tag: 'medassist' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Уведомление без разбираемого тела — всё равно уведомление: показываем как есть.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Метка склеивает повторы одного напоминания в одно уведомление.
      tag: payload.tag,
      requireInteraction: true,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url ?? '/calendar';
  const target = new URL(path.startsWith('/app') ? path : `/app${path}`, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Уже открытое приложение не открывается вторым окном — в него переходят.
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
