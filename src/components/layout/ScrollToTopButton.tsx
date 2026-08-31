import { ActionIcon, Affix, Transition } from '@mantine/core';
import { IconArrowUp } from '@tabler/icons-react';

import { useFormActionsHeight } from '../common/formActionsSlot';
import { SCROLL_ROOT_ID } from './scrollRoot';
import { useScrollDirection } from './useScrollDirection';

/** Отступ кнопки от низа окна и от панели действий, когда та есть. */
const GAP = 24;
const ABOVE_BAR = 12;

/** Mounted once at the app layout level, so it shows up on every page without each one wiring it up. */
export function ScrollToTopButton() {
  // Кнопка появляется, только когда прокрутили достаточно далеко **и** листают вверх: при движении
  // вниз пользователь читает, и загораживать ему текст кнопкой возврата незачем.
  const { visible, scrolled } = useScrollDirection();
  /*
   * Кнопка встаёт **над** панелью действий формы, а не поверх неё.
   *
   * Замер на окне 857 px: кружок ложился ровно на правый край панели и обрезал подпись
   * «Сохранить изменения». Разводить их по горизонтали — отнимать у кнопок формы место на экране,
   * где его и так мало; по вертикали они не мешают друг другу вовсе.
   *
   * Обе видны и прячутся одновременно: кнопка показывается при движении вверх, и панель при этом
   * движении как раз возвращается. Поэтому подъём постоянный, пока панель на странице есть.
   */
  const barHeight = useFormActionsHeight();

  return (
    <Affix position={{ bottom: GAP + (barHeight ? barHeight + ABOVE_BAR : 0), right: GAP }}>
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
