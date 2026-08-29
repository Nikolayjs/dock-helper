import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { isAppPath } from './lib/appBase';

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
const root = createRoot(document.getElementById('root')!);

const mount = isAppPath(window.location.pathname)
  ? import('./AppRoot').then(({ AppRoot }) => <AppRoot />)
  : import('./PublicRoot').then(({ PublicRoot }) => <PublicRoot />);

mount.then((app) => root.render(<StrictMode>{app}</StrictMode>));
