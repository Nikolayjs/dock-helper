/**
 * Client mirror of the backend's template-layout.ts. A layout template reproduces a scanned form as
 * absolutely-positioned text blocks, instead of the flowing Tiptap HTML a 'flow' template carries.
 *
 * Everything geometric is a percentage of the page, never pixels: the editor renders at whatever
 * width the browser window allows, printing happens at millimetre scale, and the source was a photo
 * of unknown resolution. Percentages are the only unit all three agree on.
 */

export type DocumentTemplateKind = 'flow' | 'layout';

export interface TemplateLayoutBlock {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  /** Of page height. */
  fontSizePct: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  /** Tesseract's confidence, or null for blocks typed by hand. */
  confidence: number | null;
}

export interface TemplateLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  /** Faded scan shown behind the blocks while editing. Never printed. */
  backdropDataUrl?: string | null;
  blocks: TemplateLayoutBlock[];
}

export interface PagePreset {
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_PRESETS: PagePreset[] = [
  { label: 'A4 книжная', widthMm: 210, heightMm: 297 },
  { label: 'A4 альбомная', widthMm: 297, heightMm: 210 },
  { label: 'A5 книжная', widthMm: 148, heightMm: 210 },
  { label: 'A5 альбомная', widthMm: 210, heightMm: 148 },
  { label: 'A6 книжная', widthMm: 105, heightMm: 148 },
  { label: 'A6 альбомная', widthMm: 148, heightMm: 105 },
];

/**
 * Below this, recognition is more likely wrong than right — the editor tints such blocks so the
 * doctor's attention goes where it is actually needed instead of over every line equally. Chosen
 * from the measured spread on real photographs: clean sentences land at 85+, anything crossed by a
 * ruled line or a stamp collapses to near zero, and there is very little in between.
 */
export const LOW_CONFIDENCE_THRESHOLD = 60;

export function createLayoutBlock(overrides: Partial<TemplateLayoutBlock> = {}): TemplateLayoutBlock {
  return {
    id: crypto.randomUUID(),
    text: 'Текст',
    xPct: 10,
    yPct: 10,
    widthPct: 40,
    heightPct: 5,
    fontSizePct: 3.5,
    bold: false,
    align: 'left',
    confidence: null,
    ...overrides,
  };
}

export function emptyLayout(preset: PagePreset = PAGE_PRESETS[5]): TemplateLayout {
  return { pageWidthMm: preset.widthMm, pageHeightMm: preset.heightMm, backdropDataUrl: null, blocks: [] };
}

/** Clamps a block back onto the page after a drag or resize, so nothing can be lost off-canvas. */
export function clampBlock(block: TemplateLayoutBlock): TemplateLayoutBlock {
  const widthPct = Math.min(100, Math.max(2, block.widthPct));
  const heightPct = Math.min(100, Math.max(1, block.heightPct));
  return {
    ...block,
    widthPct,
    heightPct,
    xPct: Math.min(100 - widthPct, Math.max(0, block.xPct)),
    yPct: Math.min(100 - heightPct, Math.max(0, block.yPct)),
  };
}
