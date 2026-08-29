import { ActionIcon, Affix, Transition } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';

import { SCROLL_ROOT_ID } from './scrollRoot';
import { useScrollDirection } from './useScrollDirection';

/** Mounted once at the app layout level, so it shows up on every page without each one wiring it up. */
export function ScrollToTopButton() {
  // Кнопка появляется, только когда прокрутили достаточно далеко **и** листают вверх: при движении
  // вниз пользователь читает, и загораживать ему текст кнопкой возврата незачем.
  const { visible, scrolled } = useScrollDirection();

  return (
    <Affix position={{ bottom: 24, right: 24 }}>
      <Transition transition="slide-up" mounted={scrolled && visible}>
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
