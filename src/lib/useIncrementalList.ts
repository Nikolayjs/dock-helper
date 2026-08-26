import { useCallback, useEffect, useRef, useState } from 'react';

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
 */
export function useIncrementalList<T>(items: readonly T[], step = 60) {
  const [count, setCount] = useState(step);
  const sentinelRef = useRef<HTMLElement | null>(null);

  // Новый набор — снова первая порция: иначе после поиска пришлось бы прокручивать вхолостую.
  useEffect(() => {
    setCount(step);
  }, [items, step]);

  const setSentinel = useCallback((node: HTMLElement | null) => {
    sentinelRef.current = node;
  }, []);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || count >= items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setCount((current) => Math.min(current + step, items.length));
        }
      },
      // Подгружаем заранее, чтобы прокрутка не упиралась в пустоту.
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [count, items.length, step]);

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    remaining: Math.max(0, items.length - count),
    setSentinel,
  };
}
