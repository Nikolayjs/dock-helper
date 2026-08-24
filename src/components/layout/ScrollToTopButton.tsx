import { useEffect, useState } from 'react';
import { ActionIcon, Affix, Transition } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';

import { SCROLL_ROOT_ID } from './scrollRoot';

const SCROLL_THRESHOLD = 300;

/** Tracks scroll position of the AppShell root (see scrollRoot.ts) instead of `window` — with
 * `mode="static"` that root element is the actual scroll container, so `window` never scrolls. */
function useScrollRootY() {
  const [y, setY] = useState(0);

  useEffect(() => {
    const el = document.getElementById(SCROLL_ROOT_ID);
    if (!el) return;
    const handle = () => setY(el.scrollTop);
    handle();
    el.addEventListener('scroll', handle, { passive: true });
    return () => el.removeEventListener('scroll', handle);
  }, []);

  return y;
}

/** Mounted once at the app layout level, so it shows up on every page without each one wiring it up. */
export function ScrollToTopButton() {
  const y = useScrollRootY();

  return (
    <Affix position={{ bottom: 24, right: 24 }}>
      <Transition transition="slide-up" mounted={y > SCROLL_THRESHOLD}>
        {(styles) => (
          <ActionIcon
            size={48}
            radius="xl"
            variant="filled"
            color="brand"
            style={{ ...styles, boxShadow: 'var(--mantine-shadow-md)' }}
            onClick={() => document.getElementById(SCROLL_ROOT_ID)?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Наверх"
          >
            <IconArrowUp size={22} />
          </ActionIcon>
        )}
      </Transition>
    </Affix>
  );
}
