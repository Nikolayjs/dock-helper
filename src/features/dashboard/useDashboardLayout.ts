import { useCallback, useMemo, useState } from 'react';

import { DASHBOARD_WIDGETS, type DashboardWidget } from './widgets';
import {
  clampSpan,
  EMPTY_LAYOUT,
  moveWidget,
  orderWidgets,
  readLayout,
  writeLayout,
  type DashboardLayout,
} from './dashboardLayout';

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(() => readLayout());

  const save = useCallback((next: DashboardLayout) => {
    setLayout(next);
    writeLayout(next);
  }, []);

  // The full catalogue in the doctor's order — the settings panel lists this, hidden ones included.
  const ordered = useMemo(() => orderWidgets(DASHBOARD_WIDGETS, layout.order), [layout.order]);
  const hidden = useMemo(() => new Set(layout.hidden), [layout.hidden]);

  const visible = useMemo(() => ordered.filter((widget) => !hidden.has(widget.id)), [ordered, hidden]);

  const toggle = useCallback(
    (id: string) => {
      const next = hidden.has(id) ? layout.hidden.filter((item) => item !== id) : [...layout.hidden, id];
      save({ ...layout, hidden: next });
    },
    [hidden, layout, save],
  );

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      // The stored order may be empty or partial, so reordering works against the resolved order.
      const current = ordered.map((widget) => widget.id);
      save({ ...layout, order: moveWidget(current, activeId, overId) });
    },
    [ordered, layout, save],
  );

  const setSetting = useCallback(
    (id: string, value: string) => {
      save({ ...layout, settings: { ...layout.settings, [id]: value } });
    },
    [layout, save],
  );

  const setSpan = useCallback(
    (id: string, span: number) => {
      save({ ...layout, spans: { ...layout.spans, [id]: clampSpan(span) } });
    },
    [layout, save],
  );

  const reset = useCallback(() => save(EMPTY_LAYOUT), [save]);

  const isCustomised =
    layout.order.length > 0 ||
    layout.hidden.length > 0 ||
    Object.keys(layout.spans).length > 0 ||
    Object.keys(layout.settings).length > 0;

  return {
    /** Ordered and switched on — what the page draws. */
    visible,
    /** Ordered, everything — what the settings panel lists. */
    all: ordered as DashboardWidget[],
    isHidden: (id: string) => hidden.has(id),
    /** The doctor's width if they set one, otherwise the widget's own. */
    spanOf: (widget: DashboardWidget) => layout.spans[widget.id] ?? widget.span,
    setSpan,
    /** The card's own choice of what to show, if the doctor made one. */
    settingOf: (id: string) => layout.settings[id],
    setSetting,
    isCustomised,
    toggle,
    reorder,
    reset,
  };
}
