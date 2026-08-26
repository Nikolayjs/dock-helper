/**
 * Reads the pixel dimensions straight out of the image bytes.
 *
 * The obvious way — put the data URL into an `Image` and read `naturalWidth` — needs a browser and
 * an await. Word needs the size of every picture written into the document as a fixed box, so the
 * export path would become async and untestable in Node for no gain. All three formats a Tiptap
 * document can contain announce their size in the first few dozen bytes, so decode it directly.
 */
export interface ImageSize {
  width: number;
  height: number;
}

export function readImageSize(bytes: Uint8Array): ImageSize | null {
  return readPng(bytes) ?? readGif(bytes) ?? readJpeg(bytes);
}

function readPng(b: Uint8Array): ImageSize | null {
  // 8-byte signature, then the IHDR chunk whose payload starts at 16 with two big-endian uint32.
  if (b.length < 24) return null;
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGif(b: Uint8Array): ImageSize | null {
  if (b.length < 10) return null;
  if (b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readJpeg(b: Uint8Array): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

  // Walk the segment chain to the start-of-frame; everything before it is metadata of variable size.
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1];
    // SOF0..SOF15 carry the frame size; DHT (c4), DAC (cc) and the RST markers sit in that range too.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}
