/**
 * Shrinks the pictures that come out of a Word file.
 *
 * Word embeds a picture at the resolution it was inserted at — a phone photo goes in at 4000 px
 * wide and a scanned page at 300 dpi — and keeps it that way forever, because Word lays out for
 * paper. This application shows the same picture in a column at most ~900 CSS px wide.
 *
 * Left alone, one such picture becomes a multi-megabyte `data:` URL, and that URL is then the
 * document: it is what the editor holds, what a save sends to the server, what the articles list
 * downloads on every visit — the list endpoint returns `content` for every document — and what the
 * browser has to hand to the operating system when someone drags the picture. Downscaling once, at
 * import, is what keeps all of those proportionate.
 */
/** Wider than any column the application renders, with room for a high-density screen. */
export const MAX_IMAGE_WIDTH = 1600;

/** Below this, re-encoding costs more than it saves — a diagram or a logo is left exactly as it is. */
export const MAX_INLINE_BYTES = 400 * 1024;

const JPEG_QUALITY = 0.82;

export function shouldShrink(byteLength: number): boolean {
  return byteLength > MAX_INLINE_BYTES;
}

/**
 * PNG colour types 4 and 6 carry an alpha channel, and so does a tRNS chunk. Such an image stays a
 * PNG: re-encoding it as JPEG would flatten transparency onto a background colour, which is wrong
 * in one of the two themes whichever colour is picked.
 */
export function pngHasAlpha(bytes: Uint8Array): boolean {
  if (bytes.length < 26) return false;
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return false;
  const colourType = bytes[25];
  if (colourType === 4 || colourType === 6) return true;

  // A palette PNG declares transparency in a separate tRNS chunk.
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  return header.includes('tRNS');
}

export function targetWidth(naturalWidth: number): number {
  return Math.min(naturalWidth, MAX_IMAGE_WIDTH);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  // Chunked: one apply() over a multi-megabyte array blows the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function encode(canvas: HTMLCanvasElement | OffscreenCanvas, mime: string): Promise<Uint8Array | null> {
  if ('convertToBlob' in canvas) {
    const blob = await canvas.convertToBlob({ type: mime, quality: JPEG_QUALITY });
    return new Uint8Array(await blob.arrayBuffer());
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, JPEG_QUALITY));
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

export interface ShrunkImage {
  bytes: Uint8Array;
  contentType: string;
}

/**
 * Returns the smaller version, or `null` to say "keep what you had" — which is the answer whenever
 * the picture is already small, the browser cannot decode it, or the re-encoded copy came out no
 * smaller. Nothing here is allowed to lose a picture: every failure falls back to the original.
 */
export async function shrinkImage(bytes: Uint8Array, contentType: string): Promise<ShrunkImage | null> {
  if (!shouldShrink(bytes.length)) return null;
  if (typeof createImageBitmap !== 'function') return null;

  try {
    const source = bytes.slice() as unknown as BlobPart;
    const bitmap = await createImageBitmap(new Blob([source], { type: contentType }));
    const width = targetWidth(bitmap.width);
    const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));

    const keepPng = contentType === 'image/png' && pngHasAlpha(bytes);
    const outputType = keepPng ? 'image/png' : 'image/jpeg';

    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement('canvas'), { width, height });
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) return null;
    context.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, width, height);
    bitmap.close?.();

    const encoded = await encode(canvas, outputType);
    if (!encoded || encoded.length >= bytes.length) return null;
    return { bytes: encoded, contentType: outputType };
  } catch {
    return null;
  }
}

/** The `src` attribute mammoth wants, built from whichever version won. */
export async function inlineImageSource(bytes: Uint8Array, contentType: string): Promise<string> {
  const shrunk = await shrinkImage(bytes, contentType);
  const final = shrunk ?? { bytes, contentType };
  return `data:${final.contentType};base64,${toBase64(final.bytes)}`;
}
