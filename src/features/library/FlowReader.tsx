import { memo, useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Stack } from '@mantine/core';
import { IconMinus, IconPlus } from '@tabler/icons-react';

import './flowReader.css';
import { SCROLL_ROOT_ID } from '../../components/layout/scrollRoot';
import { ToolbarSlot } from './ReaderBar';
import { READER_FONT_SCALE_MAX, READER_FONT_SCALE_MIN, getReaderFontScale, setReaderFontScale } from './readerPrefs';

const BASE_FONT_SIZE = 16;
/** Сколько кадров ждать, пока разметка книги уляжется и появится куда прокручивать. */
const RESTORE_FRAMES = 60;

interface FlowReaderProps {
  bodyHtml: string;
  /** Format-specific styling layered over the shared `.flow-reader` typography. */
  contentClassName?: string;
  initialProgress?: number;
  /** Hides the font-size toolbar, for distraction-free reading on small screens. */
  immersive?: boolean;
  onProgressChange?: (fraction: number) => void;
  /** Место в панели читалки под кнопки размера шрифта; без него они рисуются на месте. */
  toolbarSlot?: HTMLElement | null;
}

/**
 * The reader for formats that reflow: FB2 and DOCX. Neither has pages of its own — the text is a
 * single stream that the window's width decides the shape of — so position is a scroll fraction
 * rather than a page number, and the only control that means anything is type size. PDF and DjVu
 * are the opposite (fixed pages, a zoom level) and have their own readers.
 *
 * **Прокручивается страница, а не рамка внутри неё, и это несущее решение.** Раньше текст лежал в
 * коробке высотой 75 vh со своей прокруткой, и из этого следовало сразу три вещи, каждая
 * неправильная: у книги была вторая полоса прокрутки вплотную к первой; шапка приложения не
 * уезжала при чтении, потому что страница не двигалась вовсе, и кнопка «наверх» не появлялась по
 * той же причине; а спрятать шапку принудительно было нельзя — коробка от этого не растёт, и над
 * ней открылась бы полоса пустого фона (ровно та ошибка, что уже случилась с сайдбаром на
 * десктопе). Книга — это длинный текст, и читаться он должен так же, как статья: страницей.
 *
 * Собственная прокрутка остаётся только в полноэкранном режиме: там страницы приложения нет,
 * элемент читалки показывается браузером поверх всего, и прокручивать, кроме него, нечего.
 */
function FlowReaderView({
  bodyHtml,
  contentClassName,
  initialProgress = 0,
  immersive,
  onProgressChange,
  toolbarSlot,
}: FlowReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /** Доля прочитанного: по ней место в книге переносится при входе в полный экран и выходе. */
  const fractionRef = useRef(initialProgress);
  /**
   * Докуда можно прокрутить. Хранится, а не спрашивается на каждый кадр, и это не оптимизация «на
   * всякий случай»: `scrollHeight` — свойство, чтение которого заставляет браузер досчитать
   * раскладку, если её что-то пометило грязной. На книге в 300 000 px такое чтение стоит 30 мс
   * против нуля в чистом состоянии, а прокрутка спрашивает его каждый кадр. Значение меняется
   * только когда меняется размер книги или окна — за этим и следит `ResizeObserver`.
   */
  const maxScrollRef = useRef(0);
  const [fontScale, setFontScale] = useState(() => getReaderFontScale());

  // Кто прокручивается: корень оболочки (обычный режим) или сама рамка (полный экран).
  const scroller = () => (immersive ? containerRef.current : document.getElementById(SCROLL_ROOT_ID));

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    // Пока книга не разложилась, прокручивать некуда: `scrollHeight` равен высоте окна, и
    // восстановленное место оказалось бы нулём. Поэтому попытка повторяется по кадрам — картинки
    // из Word доезжают до своего размера не в первом.
    const restore = () => {
      const el = scroller();
      const max = el ? el.scrollHeight - el.clientHeight : 0;
      if (el && max > 0) {
        maxScrollRef.current = max;
        el.scrollTop = max * fractionRef.current;
        return;
      }
      if (frames++ < RESTORE_FRAMES) raf = requestAnimationFrame(restore);
    };
    raf = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHtml, immersive]);

  useEffect(() => {
    const el = scroller();
    const content = containerRef.current;
    if (!el || !content) return;
    const remeasure = () => {
      maxScrollRef.current = el.scrollHeight - el.clientHeight;
    };
    remeasure();
    // Картинки из Word доезжают до своего размера уже после разбора, и книга при этом растёт.
    const observer = new ResizeObserver(remeasure);
    observer.observe(content);
    if (el !== content) observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive, bodyHtml]);

  useEffect(() => {
    const el = scroller();
    if (!el) return;
    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = maxScrollRef.current;
        const fraction = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
        fractionRef.current = fraction;
        onProgressChange?.(fraction);
      });
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immersive]);

  const adjustFontScale = (delta: number) => {
    setFontScale((prev) => {
      const next = Math.min(
        READER_FONT_SCALE_MAX,
        Math.max(READER_FONT_SCALE_MIN, Math.round((prev + delta) * 100) / 100),
      );
      setReaderFontScale(next);
      return next;
    });
  };

  return (
    <Stack align="center" gap="md" w="100%">
      {!immersive && (
        <ToolbarSlot target={toolbarSlot}>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(-0.1)} title="Мельче">
              <IconMinus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={() => adjustFontScale(0.1)} title="Крупнее">
              <IconPlus size={16} />
            </ActionIcon>
          </Group>
        </ToolbarSlot>
      )}
      <div
        ref={containerRef}
        className={contentClassName ? `flow-reader ${contentClassName}` : 'flow-reader'}
        style={{
          maxHeight: immersive ? '92vh' : undefined,
          overflowY: immersive ? 'auto' : undefined,
          padding: '0 8px',
          width: '100%',
          fontSize: BASE_FONT_SIZE * fontScale,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </Stack>
  );
}

/**
 * Мемоизация здесь — не микрооптимизация, а условие плавной прокрутки.
 *
 * Страница читалки перерисовывается на каждую смену доли прочитанного и на каждое появление панели.
 * Само по себе это копейки, но вместе с перерисовкой заново собирается и эта коробка — а внутри неё
 * книга в семнадцать тысяч узлов. Замер на книге высотой 300 000 px: кадр, в котором сменилась
 * подпись, стоил около 300 мс — ровно то «зависание в какой-то момент прокрутки», о котором пришла
 * жалоба. Пропсы у читалки не меняются, поэтому её просто не нужно трогать.
 */
export const FlowReader = memo(FlowReaderView);
