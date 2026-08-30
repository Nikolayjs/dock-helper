import { useCallback, useState } from 'react';

export type SidebarSection = 'main' | 'knowledge';

type SidebarOrder = Record<SidebarSection, string[]>;

const STORAGE_KEY = 'medassist:sidebar-order';
const EMPTY_ORDER: SidebarOrder = { main: [], knowledge: [] };

function readOrder(): SidebarOrder {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_ORDER;
    const parsed = JSON.parse(raw);
    return {
      main: Array.isArray(parsed.main) ? parsed.main : [],
      knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
    };
  } catch {
    return EMPTY_ORDER;
  }
}

function writeOrder(order: SidebarOrder) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

/** Sorts `items` (each with a `path`) by the stored order, appending any item not yet in storage at the end. */
export function applyStoredOrder<T extends { path: string }>(items: T[], storedPaths: string[]): T[] {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const ordered: T[] = [];
  for (const path of storedPaths) {
    const item = byPath.get(path);
    if (item) {
      ordered.push(item);
      byPath.delete(path);
    }
  }
  return [...ordered, ...byPath.values()];
}

export function useSidebarOrder() {
  const [order, setOrder] = useState<SidebarOrder>(() => readOrder());

  const setSectionOrder = useCallback((section: SidebarSection, paths: string[]) => {
    setOrder((prev) => {
      const next = { ...prev, [section]: paths };
      writeOrder(next);
      return next;
    });
  }, []);

  const resetOrder = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setOrder(EMPTY_ORDER);
  }, []);

  const hasCustomOrder = order.main.length > 0 || order.knowledge.length > 0;

  return { order, setSectionOrder, resetOrder, hasCustomOrder };
}
