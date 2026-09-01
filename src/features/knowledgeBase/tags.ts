/**
 * Теги нечувствительны к регистру, и это не мелочь.
 *
 * Врач набирает «ЛОР», «Лор» и «лор» в разные дни, а тег — это способ собрать написанное об одном
 * в одном месте. Со строгим сравнением такой набор рассыпается на три раздела, в каждом из которых
 * лежит часть статей: список по тегу «ЛОР» честно показывает пустоту там, где статьи есть.
 *
 * Хранится при этом то, что врач написал: приводить теги к одному регистру при сохранении значило
 * бы переписывать его текст. Совпадение считается здесь, при использовании.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/ё/g, 'е');
}

export function sameTag(a: string, b: string): boolean {
  return normalizeTag(a) === normalizeTag(b);
}

export function hasTag(tags: readonly string[], tag: string): boolean {
  return tags.some((own) => sameTag(own, tag));
}
