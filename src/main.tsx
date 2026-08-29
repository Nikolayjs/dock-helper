import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import './index.css';

import { isAppPath } from './lib/appBase';

/**
 * Which of the two applications to mount is decided here, once, from the address.
 *
 * The public site and the doctor's workspace are separate routers (see `publicRouter.tsx` for why),
 * and the import is dynamic so that they are separate chunks too: a visitor on the landing page
 * must not download the editor, the PDF reader or the charts to read a headline.
 */
const root = createRoot(document.getElementById('root')!);

const mount = isAppPath(window.location.pathname)
  ? import('./AppRoot').then(({ AppRoot }) => <AppRoot />)
  : import('./PublicRoot').then(({ PublicRoot }) => <PublicRoot />);

mount.then((app) => root.render(<StrictMode>{app}</StrictMode>));
