import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { ReaderZoom } from './readerPrefs';

/**
 * Масштаб постраничной читалки и правило «никогда не открываться шире экрана».
 *
 * Страницы центрируются, и лист, который не влезает в рамку по ширине, вылезал **в обе стороны** —
 * а левая половина этого выступа недостижима: `scrollLeft` меньше нуля не бывает. Замер на телефоне
 * 390 px: лист 714 px в рамке 350 px, левый край на −162 px, и 182 px листа — весь левый отступ и
 * начало каждой строки — не показать ничем. Отсюда две вещи здесь и дорожка в самой читалке.
 *
 * Сохранённый масштаб — настройка для того окна, в котором её выбрали. Если при нём страница в
 * ширину не помещается, читалка открывается «по ширине» и **запомненное число не трогает**: врач,
 * посмотревший книгу с телефона, не должен вернуться к компьютеру с чужим масштабом.
 */

/** Запас, на который страница уже рамки: округление ширины до целого. */
const FIT_MARGIN = 2;

/**
 * «По ширине» не ограничено снизу обычным минимумом масштаба, и это не недосмотр.
 * A4 — это 595 CSS-пикселей, рамка на телефоне 390 px — около 340: нужен масштаб 0,57, а минимум
 * ручного зума 0,6. Замер: с общим ограничением лист выходил 357 px в рамке 340 — то есть «по
 * ширине» само оставляло 17 px за краем. Ограничение снизу — про то, до чего врач вправе домельчить
 * руками; «по ширине» — это ровно столько, сколько помещается.
 */
const FIT_FLOOR = 0.05;

/** Ширина элемента с отслеживанием изменений: поворот телефона меняет «по ширине». */
export function useElementWidth(node: HTMLElement | null): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (!node) {
      setWidth(0);
      return;
    }
    // Первый замер — до отрисовки: иначе страницы успевают показаться в неверном масштабе.
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return width;
}

interface ReaderZoomOptions {
  /** Запомненная настройка врача. */
  stored: ReaderZoom;
  save: (zoom: ReaderZoom) => void;
  min: number;
  max: number;
  /** Ширина страницы при масштабе 1, в CSS-пикселях; `null` — документ ещё не открыт. */
  naturalWidth: number | null;
  /** Ширина рамки, в которой страницы показываются. */
  containerWidth: number;
}

interface ReaderZoomState {
  /** `null` — «по ширине» выбрано, но мерить ещё нечего: страницы показывать рано. */
  scale: number | null;
  isFit: boolean;
  adjust: (delta: number) => void;
  fitWidth: () => void;
}

export function useReaderZoom({ stored, save, min, max, naturalWidth, containerWidth }: ReaderZoomOptions): ReaderZoomState {
  const [zoom, setZoom] = useState<ReaderZoom>(stored);
  const decidedRef = useRef(false);

  const fitScale =
    naturalWidth && containerWidth
      ? Math.min(max, Math.max(FIT_FLOOR, (containerWidth - FIT_MARGIN) / naturalWidth))
      : null;

  // Решение принимается один раз, на открытии: дальше масштабом распоряжается врач, и сужение окна
  // не должно отменять зум, которым он полез читать мелкий шрифт.
  useEffect(() => {
    if (decidedRef.current || naturalWidth === null || containerWidth === 0) return;
    decidedRef.current = true;
    if (typeof zoom === 'number' && naturalWidth * zoom > containerWidth) setZoom('fit');
  }, [naturalWidth, containerWidth, zoom]);

  const scale = zoom === 'fit' ? fitScale : zoom;

  const adjust = useCallback(
    (delta: number) => {
      if (scale === null) return;
      const next = Math.min(max, Math.max(min, Math.round((scale + delta) * 100) / 100));
      setZoom(next);
      save(next);
    },
    [scale, min, max, save],
  );

  const fitWidth = useCallback(() => {
    setZoom('fit');
    save('fit');
  }, [save]);

  return { scale, isFit: zoom === 'fit', adjust, fitWidth };
}
