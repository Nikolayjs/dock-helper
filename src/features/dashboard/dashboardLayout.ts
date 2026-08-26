/**
 * Which cards the dashboard shows, and in what order.
 *
 * Kept in `localStorage`, the way the sidebar order and the reader's zoom already are: it is a
 * preference, not data, and nothing here is worth a schema change on a database of patient records.
 * The cost is that the layout belongs to one browser — assembling it again on the laptop is a
 * minute's work, and moving it to the server later needs no change above this file.
 */
export interface DashboardLayout {
  /** Widget ids, in the order they are drawn. Ids not listed here follow, in catalogue order. */
  order: string[];
  /** Widget ids the doctor switched off. */
  hidden: string[];
  /** Widths the doctor set, out of twelve columns. Absent means the widget's own default. */
  spans: Record<string, number>;
  /** Per-card choices — which cut a card shows, and the like. Absent means the card's default. */
  settings: Record<string, string>;
}

export const STORAGE_KEY = 'medassist:dashboard-layout';

export const EMPTY_LAYOUT: DashboardLayout = { order: [], hidden: [], spans: {}, settings: {} };

/** Narrower than a quarter of the grid nothing here stays readable; wider than the grid is nothing. */
export const MIN_SPAN = 3;
export const MAX_SPAN = 12;

export function clampSpan(span: number): number {
  if (!Number.isFinite(span)) return MIN_SPAN;
  return Math.min(MAX_SPAN, Math.max(MIN_SPAN, Math.round(span)));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readSettings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const settings: Record<string, string> = {};
  for (const [id, choice] of Object.entries(value as Record<string, unknown>)) {
    if (typeof choice === 'string') settings[id] = choice;
  }
  return settings;
}

function readSpans(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const spans: Record<string, number> = {};
  for (const [id, span] of Object.entries(value as Record<string, unknown>)) {
    if (typeof span === 'number' && Number.isFinite(span)) spans[id] = clampSpan(span);
  }
  return spans;
}

export function readLayout(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<DashboardLayout>;
    return {
      order: isStringArray(parsed.order) ? parsed.order : [],
      hidden: isStringArray(parsed.hidden) ? parsed.hidden : [],
      // Layouts saved before widths or per-card choices existed simply have none.
      spans: readSpans(parsed.spans),
      settings: readSettings(parsed.settings),
    };
  } catch {
    // A corrupted preference must never take the dashboard down with it.
    return EMPTY_LAYOUT;
  }
}

export function writeLayout(layout: DashboardLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Private mode, or a full quota: the dashboard still works, it just forgets.
  }
}

/**
 * Applies a stored order to the catalogue.
 *
 * Anything stored but no longer in the catalogue is dropped, and anything new in the catalogue is
 * appended rather than lost — so a widget added in a later release turns up for doctors who
 * customised their dashboard long ago, instead of being invisible to exactly them.
 */
export function orderWidgets<T extends { id: string }>(catalogue: T[], order: string[]): T[] {
  const byId = new Map(catalogue.map((widget) => [widget.id, widget]));
  const ordered: T[] = [];

  for (const id of order) {
    const widget = byId.get(id);
    if (widget) {
      ordered.push(widget);
      byId.delete(id);
    }
  }

  return [...ordered, ...byId.values()];
}

/** Moves the widget with `activeId` to where `overId` currently sits, returning the new order. */
export function moveWidget(order: string[], activeId: string, overId: string): string[] {
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return order;

  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}
