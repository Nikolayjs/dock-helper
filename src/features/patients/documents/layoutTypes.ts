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
  /**
   * Default number of copies to impose on one printed sheet, overridable at print time. Undefined
   * on templates saved before imposition existed — read it through `copiesPerSheet()` rather than
   * directly, so those keep printing one-up instead of rendering nothing.
   */
  copiesPerSheet?: number;
  /** Faded scan shown behind the blocks while editing. Never printed. */
  backdropDataUrl?: string | null;
  blocks: TemplateLayoutBlock[];
}

/** Counts that tile a sheet without leaving it ragged. Mirrors COPIES_PER_SHEET_OPTIONS on the server. */
export const COPIES_PER_SHEET_OPTIONS = [1, 2, 4, 6, 8, 9] as const;

export function copiesPerSheet(layout: TemplateLayout): number {
  const stored = layout.copiesPerSheet;
  return stored && (COPIES_PER_SHEET_OPTIONS as readonly number[]).includes(stored) ? stored : 1;
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
 * Sheet the imposition targets. A4 in both orientations, because which one wastes less paper
 * depends entirely on the form: four A6-landscape referrals fit an A4 turned sideways at almost
 * full size (2×2, scale 0.95) and only two thirds of that upright.
 */
const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;

/** Kept clear of the sheet edge, which most office printers physically cannot reach. */
export const SHEET_MARGIN_MM = 5;

export interface SheetPlan {
  cols: number;
  rows: number;
  /** Multiplier on the form's natural size. Never above 1 — paper is filled by adding copies, not by blowing one up. */
  scale: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
}

/**
 * Picks the grid and sheet orientation that print `copies` of the form as large as possible.
 *
 * Brute force over every column count and both orientations: the search space is a couple of dozen
 * candidates, and any closed-form rule would have to special-case portrait forms on landscape
 * paper anyway. Scale is capped at 1 because enlarging a recognised A6 blank to A4 is precisely
 * the behaviour this replaces — it prints a blurry, wrong-sized form the doctor cannot file.
 */
export function planSheet(layout: TemplateLayout, copies: number): SheetPlan {
  const sheets = [
    { sheetWidthMm: A4_SHORT_MM, sheetHeightMm: A4_LONG_MM },
    { sheetWidthMm: A4_LONG_MM, sheetHeightMm: A4_SHORT_MM },
  ];

  let best: SheetPlan | null = null;
  for (const sheet of sheets) {
    const usableWidth = sheet.sheetWidthMm - SHEET_MARGIN_MM * 2;
    const usableHeight = sheet.sheetHeightMm - SHEET_MARGIN_MM * 2;
    for (let cols = 1; cols <= copies; cols++) {
      const rows = Math.ceil(copies / cols);
      const scale = Math.min(
        1,
        usableWidth / cols / layout.pageWidthMm,
        usableHeight / rows / layout.pageHeightMm,
      );
      const candidate: SheetPlan = { cols, rows, scale, ...sheet };
      if (!best || beats(candidate, best, copies)) best = candidate;
    }
  }
  return best as SheetPlan;
}

function beats(candidate: SheetPlan, incumbent: SheetPlan, copies: number): boolean {
  const EPSILON = 1e-6;
  if (candidate.scale > incumbent.scale + EPSILON) return true;
  if (candidate.scale < incumbent.scale - EPSILON) return false;
  // Same size on the page: prefer the grid that leaves fewer empty cells, so the sheet cuts up evenly.
  const emptyHere = candidate.cols * candidate.rows - copies;
  const emptyThere = incumbent.cols * incumbent.rows - copies;
  if (emptyHere !== emptyThere) return emptyHere < emptyThere;
  // Nothing left to separate them: portrait, since that is how the paper tray is loaded.
  return candidate.sheetHeightMm > candidate.sheetWidthMm && incumbent.sheetWidthMm > incumbent.sheetHeightMm;
}

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

/** По умолчанию A4 — шестая заготовка в списке. `!` здесь про длину константы, а не про данные. */
export function emptyLayout(preset: PagePreset = PAGE_PRESETS[5]!): TemplateLayout {
  return { pageWidthMm: preset.widthMm, pageHeightMm: preset.heightMm, copiesPerSheet: 1, backdropDataUrl: null, blocks: [] };
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
