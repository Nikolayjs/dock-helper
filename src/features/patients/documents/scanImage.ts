/**
 * Turning a photographed form into something worth sending to OCR. Two outputs from one crop:
 *
 *  - a big, lossless PNG for recognition. Tesseract's accuracy tracks the size of the glyphs it
 *    sees, and measurements on a real photo showed cropping away the desk — 57% of the frame — was
 *    the single biggest improvement available, ahead of any filtering;
 *  - a small JPEG for the editing backdrop, which only has to be recognisable to a human.
 */

const OCR_MAX_DIMENSION = 2400;
const BACKDROP_MAX_DIMENSION = 1200;
const BACKDROP_QUALITY = 0.72;

export interface CropRect {
  /** All four are fractions of the source image, 0–1. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Файл повреждён или не является изображением'));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function drawCrop(img: HTMLImageElement, rect: CropRect, maxDimension: number): HTMLCanvasElement {
  const sx = Math.round(rect.x * img.naturalWidth);
  const sy = Math.round(rect.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(rect.width * img.naturalWidth));
  const sh = Math.max(1, Math.round(rect.height * img.naturalHeight));

  // Only ever downscale. Upscaling here would inflate the upload without adding detail — if extra
  // resolution helps Tesseract, it has to come from a better photograph, not from interpolation.
  const scale = Math.min(1, maxDimension / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas недоступен');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Lossless crop for recognition. PNG, because JPEG artefacts around glyph edges cost accuracy. */
export function cropForRecognition(img: HTMLImageElement, rect: CropRect): Promise<Blob> {
  const canvas = drawCrop(img, rect, OCR_MAX_DIMENSION);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение'))), 'image/png');
  });
}

/** Small JPEG for the editing backdrop — it is stored inside the template, so size matters. */
export function cropForBackdrop(img: HTMLImageElement, rect: CropRect): string {
  return drawCrop(img, rect, BACKDROP_MAX_DIMENSION).toDataURL('image/jpeg', BACKDROP_QUALITY);
}

/** Aspect ratio of the crop, used to preselect the closest paper size. */
export function cropAspect(img: HTMLImageElement, rect: CropRect): number {
  return (rect.width * img.naturalWidth) / (rect.height * img.naturalHeight);
}
