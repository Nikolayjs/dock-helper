import { LayoutDocument } from './LayoutDocument';
import { SHEET_MARGIN_MM, planSheet } from './layoutTypes';
import type { TemplateLayout } from './layoutTypes';

/**
 * One sheet of paper with `copies` of a recognised form imposed on it.
 *
 * A recognised blank carries its own physical size — an A6 referral is 148×105mm and has to come
 * off the printer at exactly that, or it no longer matches the pad it is filed with. Printing it
 * alone on A4 therefore wastes three quarters of the sheet, which is what this replaces: the
 * doctor asks for four, and four land on one sheet at full size, ready to be guillotined apart.
 *
 * The `@page` rule is emitted here rather than living in index.css because the sheet's orientation
 * is chosen per form by planSheet — a stylesheet cannot know whether this particular template
 * imposes better sideways.
 */

interface LayoutSheetProps {
  layout: TemplateLayout;
  copies: number;
  resolveText?: (text: string) => string;
}

export function LayoutSheet({ layout, copies, resolveText }: LayoutSheetProps) {
  const plan = planSheet(layout, copies);

  return (
    <>
      <style>{`@page { size: ${plan.sheetWidthMm}mm ${plan.sheetHeightMm}mm; margin: 0; }`}</style>
      <div
        className="printable-sheet"
        style={{
          width: `${plan.sheetWidthMm}mm`,
          height: `${plan.sheetHeightMm}mm`,
          padding: `${SHEET_MARGIN_MM}mm`,
          display: 'grid',
          gridTemplateColumns: `repeat(${plan.cols}, 1fr)`,
          gridTemplateRows: `repeat(${plan.rows}, 1fr)`,
          background: '#fff',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: copies }, (_, index) => (
          // Each copy is centred in its cell, so the gaps between forms stay even and a single
          // straight cut separates them however the grid came out.
          <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <LayoutDocument layout={layout} printSized scale={plan.scale} resolveText={resolveText} />
          </div>
        ))}
      </div>
    </>
  );
}
