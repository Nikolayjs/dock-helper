import { ActionIcon, Affix, Transition } from '@mantine/core';
import { useWindowScroll } from '@mantine/hooks';
import { IconArrowUp } from '@tabler/icons-react';

const SCROLL_THRESHOLD = 300;

/** Mounted once at the app layout level, so it shows up on every page without each one wiring it up. */
export function ScrollToTopButton() {
  const [scroll, scrollTo] = useWindowScroll();

  return (
    <Affix position={{ bottom: 24, right: 24 }}>
      <Transition transition="slide-up" mounted={scroll.y > SCROLL_THRESHOLD}>
        {(styles) => (
          <ActionIcon
            size={48}
            radius="xl"
            variant="filled"
            color="brand"
            style={{ ...styles, boxShadow: 'var(--mantine-shadow-md)' }}
            onClick={() => scrollTo({ y: 0 })}
            aria-label="Наверх"
          >
            <IconArrowUp size={22} />
          </ActionIcon>
        )}
      </Transition>
    </Affix>
  );
}
