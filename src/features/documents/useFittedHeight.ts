import { useLayoutEffect, useState, type RefObject } from 'react';

import { SCROLL_ROOT_ID } from '../../components/layout/scrollRoot';

/**
 * Высота элемента — ровно до низа окна, а не доля от неё.
 *
 * Таблица стоит под названием, описанием, выбором пациента и тегами, и от них до низа окна остаётся
 * сильно меньше шестидесяти процентов высоты. С фиксированными `60vh` нижний край рамки уходил за
 * экран, а вместе с ним — горизонтальная полоса прокрутки и кнопки «Строка» и «Столбец»: чтобы
 * добавить строку, приходилось сначала прокрутить страницу.
 *
 * Пересчитывается при прокрутке и изменении размера: сдвигая страницу, врач меняет то, сколько
 * места осталось под рамкой. Прокрутку слушает не окно, а корень AppShell — с `mode="static"`
 * прокручивается именно он.
 *
 * Снизу высота ограничена долей окна (`minRatio`), а не одним лишь числом пикселей. Место «до низа
 * окна» на невысоком экране вырождается в полторы строки: формально таблица видна, работать в ней
 * нельзя. Половина окна — это пол, а не потолок, и он безопасен именно потому, что ставится
 * `max-height`: короткая таблица останется короткой, а длинная получит хотя бы половину экрана и
 * прокрутит страницу под себя.
 */
export function useFittedHeight(
  ref: RefObject<HTMLElement | null>,
  { reserve, min, minRatio = 0.5 }: { reserve: number; min: number; minRatio?: number },
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const element = ref.current;
      if (!element) return;
      // Панель действий формы прилипла к низу окна и перекрывает его нижнюю полосу. Не вычесть её
      // высоту — значит посчитать своим то место, которое уже занято: кнопки «Строка» и «Столбец»
      // уезжали ровно под «Сохранить».
      const actions = document.querySelector<HTMLElement>('[data-form-actions]');
      const covered = actions ? actions.getBoundingClientRect().height : 0;
      const available = window.innerHeight - element.getBoundingClientRect().top - reserve - covered;
      const floor = Math.max(min, Math.round(window.innerHeight * minRatio));
      const next = Math.max(floor, Math.round(available));
      // Порог в пиксель: без него дробные координаты после прокрутки гоняли бы состояние по кругу.
      setHeight((current) => (current !== null && Math.abs(current - next) <= 1 ? current : next));
    };

    measure();
    const root = document.getElementById(SCROLL_ROOT_ID);
    root?.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);

    // Форма над таблицей растёт от подставленного описания или выбранного пациента — тогда рамка
    // съезжает вниз, не дождавшись ни прокрутки, ни изменения размера окна.
    const observer = new ResizeObserver(measure);
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);

    return () => {
      root?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [min, minRatio, ref, reserve]);

  return height;
}
