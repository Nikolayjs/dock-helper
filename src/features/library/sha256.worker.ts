/**
 * Отпечаток книги считается в отдельном потоке.
 *
 * `crypto.subtle.digest` на двухсотмегабайтном учебнике занимает заметное время, и в основном
 * потоке это застывший интерфейс ровно в ту секунду, когда читатель добавляет книгу. Буфер
 * **передаётся**, а не копируется: после разбора метаданных он больше никому не нужен, а вторая
 * копия книги в памяти — это то, из-за чего вкладка на телефоне и падает.
 */
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const digest = await crypto.subtle.digest('SHA-256', event.data);
    const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    self.postMessage({ ok: true, hex });
  } catch (error) {
    self.postMessage({ ok: false, message: error instanceof Error ? error.message : 'digest failed' });
  }
};
