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
}

/** Панель читалки. Почему она есть и почему прилипшая — в `ReaderBar.module.css`. */
export function ReaderBar({ children, slotRef, top }: ReaderBarProps) {
  return (
    <div className={classes.bar} style={{ top }}>
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
