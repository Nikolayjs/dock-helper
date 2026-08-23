/** Trello-style fractional ordering: moving an item only ever needs to persist that one item's
 * position (the midpoint of its new neighbors), never a renumbering of the whole list/column. */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before == null && after == null) return 1;
  if (before == null) return after! - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}
