/** Reader zoom preferences, remembered across books and sessions. */

const STORAGE_KEY = 'medassist:library:reader-prefs';

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
  pdfZoom: number;
  /** Stored under its original name so an existing setting survives the rename to `reader`. */
  fb2FontScale: number;
  djvuZoom: number;
}

const DEFAULT_PREFS: ReaderPrefs = {
  pdfZoom: PDF_ZOOM_DEFAULT,
  fb2FontScale: READER_FONT_SCALE_DEFAULT,
  djvuZoom: DJVU_ZOOM_DEFAULT,
};

function readPrefs(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      pdfZoom: typeof parsed.pdfZoom === 'number' ? parsed.pdfZoom : PDF_ZOOM_DEFAULT,
      fb2FontScale: typeof parsed.fb2FontScale === 'number' ? parsed.fb2FontScale : READER_FONT_SCALE_DEFAULT,
      djvuZoom: typeof parsed.djvuZoom === 'number' ? parsed.djvuZoom : DJVU_ZOOM_DEFAULT,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(patch: Partial<ReaderPrefs>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
}

export function getPdfZoom(): number {
  return readPrefs().pdfZoom;
}

export function setPdfZoom(zoom: number): void {
  writePrefs({ pdfZoom: zoom });
}

export function getReaderFontScale(): number {
  return readPrefs().fb2FontScale;
}

export function setReaderFontScale(scale: number): void {
  writePrefs({ fb2FontScale: scale });
}

export function getDjvuZoom(): number {
  return readPrefs().djvuZoom;
}

export function setDjvuZoom(zoom: number): void {
  writePrefs({ djvuZoom: zoom });
}
