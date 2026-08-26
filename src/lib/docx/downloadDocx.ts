import type { DocxInput } from './writeDocx';

/**
 * Hands the finished document to the browser's download manager.
 *
 * The writer is imported on demand: a document is exported by a deliberate click, and until then
 * neither it nor the ZIP library it uses needs to be in the bundle.
 *
 * The object URL is revoked well after the click rather than immediately: the click is synchronous
 * but the fetch the browser starts for it is not, and revoking too early cancels the download in
 * Firefox and Safari.
 */
export async function downloadDocx(input: DocxInput): Promise<void> {
  const { docxFileName, htmlToDocxBlob } = await import('./writeDocx');

  const url = URL.createObjectURL(htmlToDocxBlob(input));
  const link = document.createElement('a');
  link.href = url;
  link.download = docxFileName(input.title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
