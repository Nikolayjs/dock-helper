import { MantineProvider } from '@mantine/core';

import { PublicRouter } from './publicRouter';
import { theme } from './theme';

/**
 * Providers for the public site — and only those it actually needs.
 *
 * No `QueryClientProvider`, no `AuthProvider`, no dates or notifications: the landing page makes no
 * requests and holds no session, and every provider left out here is code the visitor does not
 * download. The brand theme is used as declared, without the wallpaper tinting from
 * `AppearanceProvider`: wallpaper is a doctor's setting for their own workspace, not something a
 * first-time visitor has.
 */
export function PublicRoot() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <PublicRouter />
    </MantineProvider>
  );
}
