import { useEffect, useMemo, useRef, type CSSProperties } from 'react';

import type { TemplateLayout } from './layoutTypes';

/**
 * Renders a layout template — on screen, in the editor and on paper, from the same code.
 *
 * Type size is expressed in `cqh`, container query height units, where 1cqh is 1% of the page
 * element's height. That is exactly what fontSizePct means, so the block styles need no
 * measurement, no resize observer and no separate print path: the same percentages resolve
 * correctly whether the page is 400 px wide in a preview pane or 148 mm wide on paper.
 */

interface LayoutDocumentProps {
  layout: TemplateLayout;
  /** Placeholder substitution; identity when previewing the raw template. */
  resolveText?: (text: string) => string;
  /** Physical size, for printing. Otherwise the page fills its container and keeps its aspect. */
  printSized?: boolean;
  /**
   * Multiplier on the physical size, for imposing several copies on one sheet. Applied to the mm
   * box rather than as a CSS transform: every block is positioned in percentages and set in `cqh`,
   * so a smaller box already carries the type and the geometry down with it — exactly, and without
   * the softened edges a scaled bitmap would print with.
   */
  scale?: number;
  backdropOpacity?: number;
  /**
   * Блоки, в которых текст не поместился в свою рамку.
   *
   * У блока жёсткая высота и `overflow: hidden` — иначе он наехал бы на соседние графы бланка, —
   * поэтому длинный диагноз или список аллергий теряет хвост **молча**: на экране ровно то же, что
   * на бумаге, и ничто не говорит, что текст кончился не сам. Мерить это может только браузер, и
   * только там, где блок нарисован; поэтому измерение живёт здесь, а показывают его редактор (где
   * это ещё можно поправить) и страница печати (где видно настоящие данные пациента).
   */
  onOverflow?: (blockIds: string[]) => void;
  children?: React.ReactNode;
}

export function LayoutDocument({
  layout,
  resolveText,
  printSized,
  scale = 1,
  backdropOpacity = 0,
  onOverflow,
  children,
}: LayoutDocumentProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const reported = useRef<string | null>(null);
  const onOverflowRef = useRef(onOverflow);
  onOverflowRef.current = onOverflow;

  // Подпись того, от чего зависит переполнение: сам текст (уже подставленный), рамка и кегль.
  const shown = useMemo(
    () => layout.blocks.map((block) => (resolveText ? resolveText(block.text) : block.text)),
    [layout.blocks, resolveText],
  );
  const signature = useMemo(
    () => layout.blocks.map((b, i) => `${b.id}:${b.widthPct}:${b.heightPct}:${b.fontSizePct}:${shown[i]}`).join('|'),
    [layout.blocks, shown],
  );

  useEffect(() => {
    if (!onOverflowRef.current) return;
    const measure = () => {
      const root = pageRef.current;
      if (!root) return;
      const ids = [...root.querySelectorAll<HTMLElement>('[data-layout-text]')]
        .filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.dataset.layoutText ?? '');
      const key = ids.join(',');
      if (key === reported.current) return;
      reported.current = key;
      onOverflowRef.current?.(ids);
    };
    measure();
    // Шрифт доезжает позже разметки, и до него замер врёт в обе стороны.
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    if (pageRef.current) observer.observe(pageRef.current);
    return () => observer.disconnect();
  }, [signature]);

  const pageStyle: CSSProperties = printSized
    ? { width: `${layout.pageWidthMm * scale}mm`, height: `${layout.pageHeightMm * scale}mm` }
    : { width: '100%', aspectRatio: `${layout.pageWidthMm} / ${layout.pageHeightMm}` };

  return (
    <div
      ref={pageRef}
      style={{
        ...pageStyle,
        position: 'relative',
        containerType: 'size',
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
      }}
    >
      {backdropOpacity > 0 && layout.backdropDataUrl && (
        <img
          src={layout.backdropDataUrl}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            opacity: backdropOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {layout.blocks.map((block, index) => (
        <div
          key={block.id}
          data-layout-text={block.id}
          style={{
            position: 'absolute',
            left: `${block.xPct}%`,
            top: `${block.yPct}%`,
            width: `${block.widthPct}%`,
            height: `${block.heightPct}%`,
            fontSize: `${block.fontSizePct}cqh`,
            fontWeight: block.bold ? 700 : 400,
            textAlign: block.align,
            lineHeight: 1.15,
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
          }}
        >
          {shown[index]}
        </div>
      ))}

      {children}
    </div>
  );
}
