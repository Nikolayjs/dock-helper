/**
 * Русская форма существительного при числе: «1 код», «2 кода», «5 кодов».
 *
 * Нужен ровно там, где число подставляется в предложение, которое читает врач. Обойти это
 * «Скрыто кодов: 5» можно, но такая формулировка бросается в глаза именно в том сообщении, которое
 * обязано читаться как обычная фраза: сообщение об отборе и так говорит неприятное — что часть
 * справочника спрятана, — и коряво написанное, оно выглядит как ошибка программы.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** Число вместе с его формой: `withPlural(5, 'код', 'кода', 'кодов')` → «5 кодов». */
export function withPlural(count: number, one: string, few: string, many: string): string {
  return `${count} ${plural(count, one, few, many)}`;
}
