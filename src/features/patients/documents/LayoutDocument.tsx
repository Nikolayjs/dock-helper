import type { CSSProperties } from 'react';

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
  children?: React.ReactNode;
}

export function LayoutDocument({ layout, resolveText, printSized, scale = 1, backdropOpacity = 0, children }: LayoutDocumentProps) {
  const pageStyle: CSSProperties = printSized
    ? { width: `${layout.pageWidthMm * scale}mm`, height: `${layout.pageHeightMm * scale}mm` }
    : { width: '100%', aspectRatio: `${layout.pageWidthMm} / ${layout.pageHeightMm}` };

  return (
    <div
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

      {layout.blocks.map((block) => (
        <div
          key={block.id}
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
          {resolveText ? resolveText(block.text) : block.text}
        </div>
      ))}

      {children}
    </div>
  );
}
