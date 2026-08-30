import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

import { SCROLL_ROOT_ID } from '../layout/scrollRoot';
import { HEADER_HEIGHT } from '../../layouts/shellMetrics';

/**
 * Высота прилипшего блока — такая, чтобы он целиком помещался на экране **и до прокрутки, и после**.
 *
 * Прилипший блок живёт в двух положениях: пока страница не прокручена, он стоит там, где стоит (под
 * заголовком страницы), а прокрутившись — упирается в шапку приложения. Верх у этих положений
 * разный, и высота, посчитанная по одному из них, во втором даёт либо срез, либо пустое место.
 * Берётся **худшее** из двух: блок начинается ниже — значит и высоты ему меньше.
 *
 * **Ни одного замера на прокрутке, и это несущее решение.** Первая версия мерила живую позицию на
 * каждое событие прокрутки и меняла состояние — то есть перерисовывала страницу с тремя десятками
 * карточек показателей на каждый кадр, да ещё и читала размеры сразу после правки стиля. Врач
 * пожаловался на «сильные фризы», и это ровно тот случай, который уже описан в заметках про читалку:
 * всё, что слушает прокрутку, обязано отдавать наружу состояние, меняющееся **реже, чем кадр**. Здесь
 * оно не меняется вовсе: положение блока в документе от прокрутки не зависит, и пересчёт нужен
 * только при изменении размера окна.
 *
 * Цена — несколько десятков пикселей, не занятых после прокрутки. Это дешевле и среза, и дрожания.
 */
export function useStickyFitHeight(
  ref: RefObject<HTMLElement | null>,
  {
    /** Отступ между блоком и тем, к чему он прилипает, — он же снизу. */
    gap,
    /** Пол на случай низкого окна: блок в полторы строки бесполезен, пусть лучше уедет со страницей. */
    min,
    /**
     * Появился ли уже блок. Страница до прихода записи показывает загрузку и не рисует его вовсе, а
     * о появлении узла ссылка не сообщает: React не оповещает о смене `ref.current`, и эффект с
     * неизменными зависимостями второй раз не запускается.
     */
    ready = true,
  }: { gap: number; min: number; ready?: boolean },
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    /**
     * Меряется **родитель**, а не сам блок: у прилипшего элемента `getBoundingClientRect()` в
     * прокрученном состоянии показывает место, к которому он прилип, а не своё в документе.
     * Родитель — обычная колонка сетки, и её верх от прокрутки не зависит.
     */
    const root = document.getElementById(SCROLL_ROOT_ID);
    const parent = element.parentElement ?? element;
    const documentTop = parent.getBoundingClientRect().top + (root?.scrollTop ?? 0);

    // Прилипшая панель действий формы перекрывает нижнюю полосу экрана: не вычесть её высоту —
    // значит посчитать своим место, которое уже занято.
    const actions = document.querySelector<HTMLElement>('[data-form-actions]');
    const covered = actions ? actions.getBoundingClientRect().height : 0;

    const worstTop = Math.max(documentTop, HEADER_HEIGHT + gap);
    const next = Math.max(min, Math.round(window.innerHeight - worstTop - gap - covered));
    setHeight((current) => (current !== null && Math.abs(current - next) <= 1 ? current : next));
  }, [gap, min, ref]);

  useLayoutEffect(() => {
    if (!ready) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, ready]);

  return height;
}
