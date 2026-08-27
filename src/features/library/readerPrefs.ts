/** Reader zoom preferences, remembered across books and sessions. */

const STORAGE_KEY = 'medassist:library:reader-prefs';

/**
 * Масштаб читалки — либо число, либо «по ширине».
 *
 * «По ширине» не число, потому что оно зависит от окна: то же значение на телефоне и на мониторе
 * означает разные масштабы, и запомнить его числом значило бы запомнить ширину чужого экрана.
 */
export type ReaderZoom = number | 'fit';

export const PDF_ZOOM_MIN = 0.6;
export const PDF_ZOOM_MAX = 2.4;
export const PDF_ZOOM_DEFAULT = 1.2;

/** Type size for the reflowable reader — shared by FB2 and DOCX, which is one reading preference. */
export const READER_FONT_SCALE_MIN = 0.8;
export const READER_FONT_SCALE_MAX = 1.8;
export const READER_FONT_SCALE_DEFAULT = 1;

export const DJVU_ZOOM_MIN = 0.6;
export const DJVU_ZOOM_MAX = 2.4;
export const DJVU_ZOOM_DEFAULT = 1;

interface ReaderPrefs {
  pdfZoom: ReaderZoom;
  /** Stored under its original name so an existing setting survives the rename to `reader`. */
  fb2FontScale: number;
  djvuZoom: ReaderZoom;
}

const DEFAULT_PREFS: ReaderPrefs = {
  pdfZoom: PDF_ZOOM_DEFAULT,
  fb2FontScale: READER_FONT_SCALE_DEFAULT,
  djvuZoom: DJVU_ZOOM_DEFAULT,
};

/** Настройка, записанная прежней версией, — обычное число; она остаётся действительной. */
function readZoom(value: unknown, fallback: number): ReaderZoom {
  if (value === 'fit') return 'fit';
  return typeof value === 'number' ? value : fallback;
}

function readPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      pdfZoom: readZoom(parsed.pdfZoom, PDF_ZOOM_DEFAULT),
      fb2FontScale: typeof parsed.fb2FontScale === 'number' ? parsed.fb2FontScale : READER_FONT_SCALE_DEFAULT,
      djvuZoom: readZoom(parsed.djvuZoom, DJVU_ZOOM_DEFAULT),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(patch: Partial<ReaderPrefs>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
}

export function getPdfZoom(): ReaderZoom {
  return readPrefs().pdfZoom;
}

export function setPdfZoom(zoom: ReaderZoom): void {
  writePrefs({ pdfZoom: zoom });
}

export function getReaderFontScale(): number {
  return readPrefs().fb2FontScale;
}

export function setReaderFontScale(scale: number): void {
  writePrefs({ fb2FontScale: scale });
}

export function getDjvuZoom(): ReaderZoom {
  return readPrefs().djvuZoom;
}

export function setDjvuZoom(zoom: ReaderZoom): void {
  writePrefs({ djvuZoom: zoom });
}
