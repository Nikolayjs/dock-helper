import { useEffect, useRef, useState } from 'react';

import { SCROLL_ROOT_ID } from './scrollRoot';

/** Ниже этого сдвига считаем, что пользователь не листает, а просто дрогнула рука или инерция. */
const MOVE_THRESHOLD = 8;
/** У самого верха шапка нужна всегда: там ещё нечего читать, а искать её негде. */
const TOP_ZONE = 80;

export interface ScrollState {
  /** Показывать прилипшие элементы: шапку и кнопку «наверх». */
  visible: boolean;
  /** Текущая прокрутка корня оболочки. */
  y: number;
}

/**
 * Куда листают: вниз — прилипшее прячется, вверх — возвращается.
 *
 * Считается по корню оболочки, а не по `window`: в режиме `static` прокручивается именно он, а окно
 * не двигается никогда (см. `scrollRoot.ts`).
 *
 * **На месте ничего не прячется, и это осознанное отступление от буквального «остановился —
 * скрыты».** Шапку и кнопку «наверх» пользователь достаёт одним движением вверх; если через
 * секунду после этого они исчезнут сами, получится ровно то враньё, из-за которого в этом
 * приложении переделывали кнопку «назад» — элемент обещает одно, а делает другое. Кнопка «наверх»
 * при этом существует только чтобы её нажали: спрятать её, пока пользователь до неё тянется,
 * значит сделать её бесполезной. Поэтому состояние меняет только само направление прокрутки.
 *
 * Порог в 8 px нужен из-за инерционной прокрутки на телефоне: без него шапка дёргалась бы на
 * микросдвигах в конце жеста.
 */
export function useScrollDirection(): ScrollState {
  const [state, setState] = useState<ScrollState>({ visible: true, y: 0 });
  const lastY = useRef(0);

  useEffect(() => {
    const el = document.getElementById(SCROLL_ROOT_ID);
    if (!el) return;

    lastY.current = el.scrollTop;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const y = el.scrollTop;
      const delta = y - lastY.current;

      setState((previous) => {
        // У верха и при слишком маленьком сдвиге прежнее решение сохраняется.
        const visible = y <= TOP_ZONE ? true : Math.abs(delta) < MOVE_THRESHOLD ? previous.visible : delta < 0;
        if (Math.abs(delta) >= MOVE_THRESHOLD) lastY.current = y;
        return previous.visible === visible && previous.y === y ? previous : { visible, y };
      });
    };

    // Прокрутка приходит десятками событий в секунду; замер откладывается до кадра отрисовки,
    // иначе на каждое событие шёл бы свой рендер.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return state;
}
