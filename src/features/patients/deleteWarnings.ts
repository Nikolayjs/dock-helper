/**
 * What a deletion takes with it, spelled out for the confirmation dialog.
 *
 * A patient is not one row: the visits hang off them, and a doctor who has been keeping notes for a
 * year should be told that before confirming, not after. The counts are declined properly because a
 * dialog that says «4 визита удалятся» in the wrong case reads like a machine wrote it, and the
 * whole point of the dialog is that it gets read.
 */

function plural(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  const last = count % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Undefined when there is nothing extra to warn about — the dialog then says only what it must. */
export function visitsWarning(count: number): string | undefined {
  if (count === 0) return undefined;
  return `Вместе с пациентом удалятся ${count} ${plural(count, 'визит', 'визита', 'визитов')}.`;
}

export function observationsWarning(count: number): string | undefined {
  if (count === 0) return undefined;
  return `Вместе с картой удалятся ${count} ${plural(count, 'осмотр', 'осмотра', 'осмотров')}.`;
}
