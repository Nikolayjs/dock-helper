import { useCallback, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const STORAGE_KEY = 'medassist:sidebar-width';
const DEFAULT_WIDTH = 268;

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_COLLAPSED_WIDTH = 76;
const COLLAPSE_THRESHOLD = 160;
/** Below this viewport width the sidebar always shows collapsed (icon-only), regardless of the
 * stored preference — a full ~268px sidebar eats a disproportionate share of a tablet-sized
 * screen. Manual resize/toggle still update the stored preference underneath, they just don't
 * visibly do anything until the viewport widens past this again. */
const NARROW_VIEWPORT_BREAKPOINT = 1150;

function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= NARROW_VIEWPORT_BREAKPOINT,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${NARROW_VIEWPORT_BREAKPOINT}px)`);
    const update = () => setIsNarrow(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isNarrow;
}

interface StoredSidebarWidth {
  width: number;
  collapsed: boolean;
}

function readStored(): StoredSidebarWidth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { width: DEFAULT_WIDTH, collapsed: false };
    const parsed = JSON.parse(raw);
    return {
      width: typeof parsed.width === 'number' ? parsed.width : DEFAULT_WIDTH,
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return { width: DEFAULT_WIDTH, collapsed: false };
  }
}

function writeStored(state: StoredSidebarWidth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useSidebarWidth() {
  const [expandedWidth, setExpandedWidth] = useState(() => readStored().width);
  const [manualCollapsed, setCollapsed] = useState(() => readStored().collapsed);
  const isNarrowViewport = useIsNarrowViewport();
  const collapsed = isNarrowViewport || manualCollapsed;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeStored({ width: expandedWidth, collapsed: next });
      return next;
    });
  }, [expandedWidth]);

  const startResize = useCallback(
    (startEvent: ReactPointerEvent) => {
      startEvent.preventDefault();
      const startX = startEvent.clientX;
      const startWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;
      let currentWidth = expandedWidth;
      let currentCollapsed = collapsed;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvent: PointerEvent) => {
        const rawWidth = startWidth + (moveEvent.clientX - startX);
        if (rawWidth < COLLAPSE_THRESHOLD) {
          currentCollapsed = true;
          setCollapsed(true);
        } else {
          currentCollapsed = false;
          currentWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, rawWidth));
          setCollapsed(false);
          setExpandedWidth(currentWidth);
        }
      };

      const handleUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
        window.removeEventListener('pointercancel', handleUp);
        writeStored({ width: currentWidth, collapsed: currentCollapsed });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      // Without this, a touch-drag that the browser reinterprets as its own gesture (scrolling
      // the page, pull-to-refresh — easy to trigger by grazing this thin handle on a tablet)
      // fires pointercancel instead of pointerup. handleUp above would then never run, leaving
      // handleMove permanently attached to the window — every later pointermove anywhere on the
      // page (scrolling, tapping elsewhere) would keep resizing the sidebar. Mouse drags on
      // desktop essentially never hit this path, which is why it only shows up on tablets.
      window.addEventListener('pointercancel', handleUp);
    },
    [collapsed, expandedWidth],
  );

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  return { width, collapsed, startResize, toggleCollapsed };
}
