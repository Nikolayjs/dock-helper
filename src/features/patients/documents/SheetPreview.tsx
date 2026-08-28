import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import classes from './sheetPreview.module.css';

interface SheetPreviewProps {
  children: ReactNode;
}

/**
 * Показывает печатный лист целиком на любом экране.
 *
 * Лист бланка живёт в миллиметрах — это его физический размер, и менять его нельзя. На телефоне это
 * значит, что в рамку шириной 308 px попадает 44 % листа шириной 794. Замер и был поводом: понять,
 * какой бланк перед тобой, по такому куску нельзя.
 *
 * Уменьшается лист трансформацией, а не размерами: внутри всё задано процентами и `cqh`, поэтому
 * пересчёт размеров сдвинул бы блоки относительно подложки, а `scale` показывает в точности то, что
 * уйдёт на печать. Масштаб только вниз и только по нужде: помещается — остаётся единица.
 *
 * Для потокового шаблона (обычный HTML, который сам переносится) ничего не делает: `.printable-sheet`
 * там нет, масштаб остаётся единицей.
 */
export function SheetPreview({ children }: SheetPreviewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const sheet = frame.querySelector<HTMLElement>('.printable-sheet');
    // `offsetWidth` — размер до трансформации. `getBoundingClientRect` вернул бы уже уменьшенный,
    // и замер поехал бы вслед за собственным результатом.
    const natural = sheet?.offsetWidth ?? 0;
    if (!sheet || !natural) {
      setScale(1);
      setHeight(null);
      return;
    }
    const next = Math.min(1, frame.clientWidth / natural);
    // Замер меняет высоту страницы, высота может убрать или вернуть полосу прокрутки, а полоса —
    // изменить ширину рамки, с которой всё началось. Порог рвёт эту петлю: доли процента разницы
    // на глаз не видны, а дребезг замера прекращают.
    setScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    setHeight((prev) => {
      const value = sheet.offsetHeight * next;
      return prev !== null && Math.abs(prev - value) < 1 ? prev : value;
    });
  }, []);

  useLayoutEffect(measure);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    // Наблюдаем за рамкой, а высоту ставим внутреннему блоку: иначе замер менял бы то, что меряет.
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure]);

  const style = { '--sheet-scale': scale, height: height ?? undefined } as CSSProperties;

  return (
    <div ref={frameRef} className={classes.frame}>
      <div className={classes.fit} style={style}>
        {children}
      </div>
    </div>
  );
}
