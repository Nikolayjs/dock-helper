import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import classes from './ReaderBar.module.css';

interface ReaderBarProps {
  /** Верхний ряд: «Назад», название книги, положение в ней, полный экран. */
  children: ReactNode;
  /** Куда читалка положит свои кнопки. Пустое место схлопывается, см. `.slot:empty`. */
  slotRef: (element: HTMLDivElement | null) => void;
  /** К чему прилипать. В полноэкранном режиме шапки приложения нет, и это ноль. */
  top: string | number;
  /** Убрана ли панель за верхний край: листают вниз — читают, и панель не нужна. */
  hidden?: boolean;
  /**
   * Лежать поверх содержимого, а не над ним.
   *
   * У постраничных читалок страница не прокручивается — прокручивается их рамка, — и панель,
   * стоящая в потоке, оставила бы после себя пустую полосу ровно там, где была: спрятать её значит
   * убрать картинку, а не освободить место. Поэтому там она ложится на лист сверху, как в любой
   * настоящей смотрелке PDF, и спрятанная действительно отдаёт своё место документу.
   */
  overlay?: boolean;
  /** Сама панель — её высоту меряет страница, чтобы отступить на неё сверху листа. */
  rootRef?: (element: HTMLDivElement | null) => void;
}

/** Панель читалки. Почему она есть и почему прилипшая — в `ReaderBar.module.css`. */
export function ReaderBar({ children, slotRef, top, hidden, overlay, rootRef }: ReaderBarProps) {
  const className = [classes.bar, overlay ? classes.overlay : '', hidden ? classes.hidden : ''].filter(Boolean).join(' ');
  return (
    <div className={className} style={overlay ? undefined : { top }} aria-hidden={hidden} ref={rootRef}>
      {children}
      <div className={classes.slot} ref={slotRef} />
    </div>
  );
}

/**
 * Кнопки читалки — в панель страницы, если место для них есть.
 *
 * Панель принадлежит странице (у всех трёх читалок она одна и та же), а кнопки знает только сама
 * читалка: у потоковой это размер шрифта, у постраничных — номер страницы и масштаб, и всё их
 * состояние живёт внутри. Поднимать его наверх значило бы держать одно и то же в двух местах;
 * поэтому кнопки остаются там, где живут, а показываются там, где им место.
 *
 * Без панели (читалка вставлена куда-то ещё) кнопки рисуются на месте — как раньше.
 */
export function ToolbarSlot({ target, children }: { target?: HTMLElement | null; children: ReactNode }) {
  return target ? createPortal(children, target) : <>{children}</>;
}
