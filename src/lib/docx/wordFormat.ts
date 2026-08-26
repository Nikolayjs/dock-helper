/**
 * Tells the two things called "Word file" apart.
 *
 * `.docx` is a ZIP of XML — readable here, in the browser, with no server and no converter.
 * `.doc` is the pre-2007 binary format: an OLE2 compound file whose text lives in a piece table
 * split across streams. No maintained JavaScript library reads it, and the ones that convert it
 * (LibreOffice, antiword) are native binaries — half a gigabyte in the image, pulled through a
 * registry that already refuses Russian IPs. So `.doc` is refused, by content and not by extension,
 * with the two-click fix in the message. Same call as HEIC in the template scanner.
 */
export type WordFormat = 'docx' | 'legacy-doc';

/** Word 2007+ / OpenDocument: a ZIP. Every one starts with the local file header signature. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** OLE2 compound file, the container of Word 97–2003 documents (and of .xls, .ppt). */
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export const LEGACY_DOC_MESSAGE =
  'Это файл Word 97–2003 (.doc) — старый двоичный формат, который браузер прочитать не может. ' +
  'Откройте его в Word и сохраните заново: Файл → Сохранить как → «Документ Word (.docx)».';

export const NOT_A_WORD_FILE_MESSAGE = 'Файл не похож на документ Word: внутри не оказалось ни .docx, ни .doc.';

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Sniffs the real format. Extensions lie in both directions — a `.doc` that is really RTF opens
 * fine in Word and would be refused here on its name alone, and a `.docx` that is really a `.doc`
 * would reach the ZIP reader and fail with a stack trace instead of an instruction.
 */
export function detectWordFormat(bytes: Uint8Array): WordFormat | null {
  if (startsWith(bytes, ZIP_SIGNATURE)) return 'docx';
  if (startsWith(bytes, OLE2_SIGNATURE)) return 'legacy-doc';
  return null;
}

export class WordFormatError extends Error {}

/** Throws the message a doctor can act on; returns nothing useful otherwise. */
export function assertReadableDocx(bytes: Uint8Array): void {
  const format = detectWordFormat(bytes);
  if (format === 'docx') return;
  throw new WordFormatError(format === 'legacy-doc' ? LEGACY_DOC_MESSAGE : NOT_A_WORD_FILE_MESSAGE);
}
