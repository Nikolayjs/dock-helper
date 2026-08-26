import type { XlsxInput } from './writeXlsx';

/**
 * Отдаёт собранную таблицу менеджеру загрузок браузера.
 *
 * Писатель подключается по требованию — тем же приёмом, что и `downloadDocx`: таблицу выгружают
 * осознанным нажатием, и до него ни конвертер, ни архиватор в сборке не нужны.
 *
 * Ссылка на объект отзывается сильно позже нажатия: само нажатие синхронно, а запрос, который
 * браузер под него начинает, — нет, и слишком ранний отзыв отменяет загрузку в Firefox и Safari.
 */
export async function downloadXlsx(input: XlsxInput): Promise<void> {
  const { sheetToXlsxBlob, xlsxFileName } = await import('./writeXlsx');

  const url = URL.createObjectURL(sheetToXlsxBlob(input));
  const link = document.createElement('a');
  link.href = url;
  link.download = xlsxFileName(input.sheetName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
