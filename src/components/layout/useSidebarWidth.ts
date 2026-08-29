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
/** Below this the AppShell navbar itself switches to an off-canvas mobile drawer (must match the
 * `breakpoint="sm"` passed to `AppShell`'s `navbar` prop — Mantine's default `sm` is 48em/768px).
 * The drawer already only appears when opened via the burger button and should show full width
 * with labels then, so the icon-only auto-collapse below must not apply in this range — applying
 * it there made the opened drawer render icon-only instead of the full slide-out panel. */
const MOBILE_DRAWER_BREAKPOINT = 768;

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);

  return matches;
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
  const isNarrowViewport = useMedia(
    `(min-width: ${MOBILE_DRAWER_BREAKPOINT}px) and (max-width: ${NARROW_VIEWPORT_BREAKPOINT}px)`,
  );
  const isMobileDrawer = useMedia(`(max-width: ${MOBILE_DRAWER_BREAKPOINT - 1}px)`);
  /*
   * Выдвижная панель никогда не бывает свёрнутой, и запомненный на десктопе выбор её не касается.
   *
   * Свёрнутый вид — это узкая полоса значков рядом с содержимым; у панели, которую вызывают
   * бургером, содержимого рядом нет, а Mantine растягивает её на всю ширину экрана. Получался
   * список из одних значков во весь экран — ровно то, на что и пожаловались. Раньше из-под
   * автоматического сворачивания был выведен только диапазон планшета (`isNarrowViewport`
   * начинается с `MOBILE_DRAWER_BREAKPOINT`), а сохранённый ручной выбор — нет, и он протекал
   * с десктопа на телефон через `localStorage`.
   */
  const collapsed = !isMobileDrawer && (isNarrowViewport || manualCollapsed);

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

  // На выдвижной панели ширину задаёт Mantine (100 % экрана), но подпираем её обычной шириной, а
  // не свёрнутой: сохранённая с десктопа полоса в 76 px не должна быть видна нигде на телефоне.
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedWidth;

  return { width, collapsed, startResize, toggleCollapsed };
}
