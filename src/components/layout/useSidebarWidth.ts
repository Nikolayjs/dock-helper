import { useCallback, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const STORAGE_KEY = 'medassist:sidebar-width';
const DEFAULT_WIDTH = 268;

export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_COLLAPSED_WIDTH = 76;
const COLLAPSE_THRESHOLD = 160;

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
  const [collapsed, setCollapsed] = useState(() => readStored().collapsed);

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
        writeStored({ width: currentWidth, collapsed: currentCollapsed });
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [collapsed, expandedWidth],
  );

  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  return { width, collapsed, startResize, toggleCollapsed };
}
