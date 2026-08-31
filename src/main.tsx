import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { isAppPath } from './lib/appBase';
import { registerServiceWorker } from './lib/pushNotifications';
import { listenForStaleChunks } from './lib/staleChunkReload';

/**
 * Which of the two applications to mount is decided here, once, from the address.
 *
 * The public site and the doctor's workspace are separate routers (see `publicRouter.tsx` for why),
 * and the import is dynamic so that they are separate chunks too: a visitor on the landing page
 * must not download the editor, the PDF reader or the charts to read a headline.
 *
 * No stylesheet is imported here on purpose. Each root brings its own, and each brings `index.css`
 * last: our own rules override Mantine's, and a stylesheet loaded from the entry would land
 * *before* one loaded from a dynamically imported chunk — that is, the overrides would lose.
 */
// Ставится до монтирования: страницы грузятся лениво, и первый же переход во вкладке, пережившей
// деплой, может попросить файл, которого больше нет.
listenForStaleChunks();

// Фоновый обработчик: он нужен и для уведомлений при закрытом приложении, и для установки на
// устройство. Регистрируется после монтирования и ничего не ждёт — приложение полно и без него.
void registerServiceWorker();

const root = createRoot(document.getElementById('root')!);

const mount = isAppPath(window.location.pathname)
  ? import('./AppRoot').then(({ AppRoot }) => <AppRoot />)
  : import('./PublicRoot').then(({ PublicRoot }) => <PublicRoot />);

mount.then((app) => root.render(<StrictMode>{app}</StrictMode>));
