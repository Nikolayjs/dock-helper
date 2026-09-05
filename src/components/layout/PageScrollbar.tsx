import { useEffect, useRef } from 'react';

import { SCROLL_ROOT_ID } from './scrollRoot';
import classes from './PageScrollbar.module.css';

/**
 * Указатель прокрутки страницы — накладной, вместо родной полосы.
 *
 * Родную у корня оболочки выключили: классическая полоса на десктопе отнимает свои десять пикселей
 * у **каждой** страницы, и справа от шапки и подложки оставалась полоса обоев. Накладной ползунок
 * не занимает места вовсе, а отвечает на тот же вопрос — сколько ещё осталось.
 *
 * **Ни одного React-рендера на прокрутку.** Положение пишется прямо в стиль узла внутри кадра
 * отрисовки: это ровно та ошибка, что стоила читалке книг трёхсотмиллисекундных кадров — состояние,
 * меняющееся каждый кадр, перерисовывает всех подписчиков, а следующее же чтение размера заставляет
 * браузер пересчитать раскладку целиком. Здесь наружу не отдаётся ничего, а размеры читаются
 * **до** записи, в одном и том же кадре.
 */

/** Короче этого ползунок перестаёт читаться как ползунок — на очень длинных документах он и упёрся бы в предел. */
const MIN_THUMB = 28;

interface PageScrollbarProps {
  /**
   * Отступ сверху: высота шапки, когда она видна, и ноль, когда уехала.
   *
   * Приходит пропсом от `AppLayout`, а не считается здесь: она и так знает `showHeader`, а читать
   * переменную `--app-sticky-top` значило бы звать `getComputedStyle` на каждый кадр прокрутки.
   */
  top: number;
}

export function PageScrollbar({ top }: PageScrollbarProps) {
  const thumb = useRef<HTMLDivElement>(null);
  /* Читается обработчиками мыши; в состоянии ему делать нечего — от него ничего не рисуется. */
  const geometry = useRef({ maxScroll: 0, travel: 0 });

  useEffect(() => {
    const root = document.getElementById(SCROLL_ROOT_ID);
    const node = thumb.current;
    if (!root || !node) return undefined;

    let frame = 0;

    const measure = () => {
      frame = 0;
      // Сначала все чтения, потом все записи: перемешанные, они дают пересчёт раскладки на кадр.
      const viewport = root.clientHeight - top;
      const maxScroll = root.scrollHeight - root.clientHeight;

      if (maxScroll <= 0 || viewport <= MIN_THUMB) {
        geometry.current = { maxScroll: 0, travel: 0 };
        node.hidden = true;
        return;
      }

      const height = Math.max(MIN_THUMB, Math.round((viewport * viewport) / root.scrollHeight));
      const travel = viewport - height;
      const offset = travel > 0 ? (root.scrollTop / maxScroll) * travel : 0;

      geometry.current = { maxScroll, travel };
      node.hidden = false;
      node.style.top = `${top}px`;
      node.style.height = `${height}px`;
      node.style.transform = `translateY(${Math.round(offset)}px)`;
    };

    // Прокрутка приходит десятками событий в секунду; замер откладывается до кадра отрисовки.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    /*
     * Высота страницы меняется и без прокрутки: подгружается порция длинного списка, доезжают
     * картинки, раскрывается раздел. Без наблюдателя ползунок появлялся только после первой
     * прокрутки — то есть ровно тогда, когда указатель уже не нужен, а до неё длинная рекомендация
     * выглядела как страница, которую некуда листать.
     *
     * **Наблюдать надо за `[data-page-content]`, и это замер.** Ни корень, ни `Main` от роста
     * страницы не меняются: у корня коробка равна окну, у `Main` — 712 px при содержимом на 85 846,
     * которое его просто переполняет. Растёт только обёртка содержимого, она и помечена.
     *
     * За детьми корня скопом — нельзя: среди них сам ползунок, а наблюдение за собственной высотой
     * это петля, которую браузер отдаёт предупреждением «ResizeObserver loop».
     */
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    const content = root.querySelector('[data-page-content]');
    if (content) observer.observe(content);

    return () => {
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [top]);

  /*
   * Ползунок тянется мышью, как родной.
   *
   * Без этого правка была бы разменом: место на экране в обмен на способ быстро пройти документ на
   * сто тридцать тысяч пикселей. Захват указателя обязателен — курсор во время протяжки уходит с
   * узкой полоски, ровно как у уголка картинки и у границы столбца таблицы.
   */
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = document.getElementById(SCROLL_ROOT_ID);
    const node = thumb.current;
    if (!root || !node) return;

    const { maxScroll, travel } = geometry.current;
    if (maxScroll <= 0 || travel <= 0) return;

    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    node.classList.add(classes.dragging);

    const startY = event.clientY;
    const startScroll = root.scrollTop;

    const move = (moved: PointerEvent) => {
      root.scrollTop = startScroll + ((moved.clientY - startY) / travel) * maxScroll;
    };
    const stop = () => {
      node.classList.remove(classes.dragging);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', stop);
      node.removeEventListener('pointercancel', stop);
    };

    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', stop);
    node.addEventListener('pointercancel', stop);
  };

  // Диктору он не нужен: то же самое сообщает сама прокрутка, а нажимать здесь не на что.
  return <div ref={thumb} className={classes.thumb} onPointerDown={startDrag} aria-hidden hidden />;
}
