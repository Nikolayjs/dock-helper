import { useEffect, useState } from 'react';

/**
 * Отдаёт список порциями по мере прокрутки.
 *
 * Справочник препаратов вырос до нескольких сотен строк, и браузер честно строил их все: 673 строки
 * давали 23 тысячи узлов DOM. На настольном компьютере это лишь заметно, на телефоне — ощутимо при
 * каждом открытии раздела и при каждом нажатии на заголовок сортировки.
 *
 * Фильтрация и сортировка при этом остаются по **всему** набору: порционно только рисуется. Поэтому
 * поиск по-прежнему находит препарат, который в исходном списке стоял бы шестисотым.
 *
 * `items` должен быть стабильным между рендерами (useMemo) — его смена считается сменой набора и
 * возвращает счётчик к первой порции, что и нужно при новом поиске или сортировке.
 *
 * **Список, живущий в своей рамке с прокруткой, обязан назвать её `root`.** Наблюдатель по умолчанию
 * сравнивает метку с окном, а метка, лежащая ниже рамки, обрезана её `overflow` — то есть не видна
 * ни при какой прокрутке рамки, и дозагрузка не наступает никогда. Ровно это и случилось в окне
 * списка взаимодействий: строка «загружается ещё… осталось 979» висела, а ничего не грузилось.
 */
export function useIncrementalList<T>(items: readonly T[], step = 60, options: { root?: HTMLElement | null } = {}) {
  const { root } = options;
  const [count, setCount] = useState(step);
  // Метка держится в состоянии, а не в ссылке: смену узла React не сообщает, и эффект, зависящий
  // от ссылки, не пересоздал бы наблюдателя.
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  // Новый набор — снова первая порция: иначе после поиска пришлось бы прокручивать вхолостую.
  useEffect(() => {
    setCount(step);
  }, [items, step]);

  useEffect(() => {
    if (!sentinel || count >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCount((current) => Math.min(current + step, items.length));
        }
      },
      // Подгружаем заранее, чтобы прокрутка не упиралась в пустоту.
      { root, rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, count, items.length, step, root]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    remaining: Math.max(0, items.length - count),
    setSentinel,
  };
}
