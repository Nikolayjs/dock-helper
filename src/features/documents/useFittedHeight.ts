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

/** На совсем низком окне рабочее место всё равно должно оставаться рабочим. */
const MIN_WORKSPACE_HEIGHT = 320;

/**
 * Высота блока, подобранная так, чтобы **прокрутка страницы кончалась ровно на нём**: докрутив
 * страницу до конца, врач видит блок от шапки приложения до низа окна.
 *
 * Это и есть «максимально доступная высота». Форма над таблицей — название, описание, пациент,
 * теги — заполняется один раз, а в таблице работают; поэтому она имеет право уехать вверх, а таблица
 * обязана занять освободившееся место. Само по себе это не работает: если блок ростом с оставшийся
 * экран, странице некуда прокручиваться и шапка формы никогда не уедет; если он выше — страница
 * прокручивается **дальше**, чем нужно, и панель инструментов уходит под шапку приложения.
 *
 * Поэтому высота считается от «хвоста» — всего, что лежит под блоком до конца прокручиваемого
 * содержимого (панель «Сохранить», отступы страницы). Хвост от высоты блока не зависит, а вот
 * предел прокрутки после этого сходится точно: `maxScroll = отступ блока сверху − top`.
 *
 * `position: sticky` здесь бесполезен, и это стоило замера: прилипший блок ездит только внутри
 * своего родителя, а родитель облегает его вплотную — запаса нет, и прилипание не срабатывает
 * вовсе. Первая попытка так и осталась стоять на месте: `top` = 4 px при `top: 68px` в стилях.
 */
export function usePageFillHeight(ref: RefObject<HTMLElement | null>, top: number): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const element = ref.current;
      const root = document.getElementById(SCROLL_ROOT_ID);
      if (!element || !root) return;

      const rootRect = root.getBoundingClientRect();
      // Низ всего прокручиваемого содержимого в координатах окна.
      const contentBottom = rootRect.top + root.scrollHeight - root.scrollTop;
      const tail = contentBottom - element.getBoundingClientRect().bottom;
      const next = Math.max(MIN_WORKSPACE_HEIGHT, Math.round(root.clientHeight - top - tail));
      setHeight((current) => (current !== null && Math.abs(current - next) <= 1 ? current : next));
    };

    measure();
    window.addEventListener('resize', measure);
    // Хвост меняется вместе с панелью действий: она появляется вместе с формой и вырастает во вторую
    // строку на узком окне.
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, [ref, top]);

  return height;
}
