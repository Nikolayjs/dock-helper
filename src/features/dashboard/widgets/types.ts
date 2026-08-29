import type { ReactNode } from 'react';

import type { DashboardContext } from '../dashboardContext';

/**
 * Everything the dashboard can show, as one list.
 *
 * The page renders whatever the doctor's layout names, in the order it names it — so a widget is
 * defined once here and needs no change to the page. `span` is the width on a wide screen out of
 * twelve; below `md` everything is full width, because a stat card squeezed to a quarter of a phone
 * is unreadable.
 */
export interface DashboardWidget {
  id: string;
  /** Shown in the settings panel, not on the card — the card carries its own heading. */
  title: string;
  description: string;
  span: number;
  /** The widget draws its own card (a StatCard does) and must not be wrapped in another one. */
  bare?: boolean;
  render: (ctx: DashboardContext) => ReactNode;
  /**
   * True when there is genuinely nothing to draw. Such a widget is skipped on the page and marked
   * "пусто" in the settings panel, so an empty block never takes up a screen. Counters deliberately
   * do not define this: a queue at zero is news worth reading, not an absence.
   */
  isEmpty?: (ctx: DashboardContext) => boolean;
}
