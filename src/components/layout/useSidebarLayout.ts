import { useCallback, useState } from 'react';

import { readSetting, removeSetting, writeSetting } from '../../lib/settingsStore';

/**
 * Боковое меню собирает врач: что где лежит, что убрано и как называется.
 *
 * Разделов в приложении семнадцать, и они одинаковы для всех — а нужны разные: кардиолог не
 * открывает «Диагностику», терапевт не открывает «Библиотеку». Угадывать за врача, что ему не
 * нужно, мы уже пробовали в магазине и перестали.
 *
 * **Спрятать — значит переложить, а не пометить.** Отдельного флажка «скрыт» нет: убранный пункт
 * переезжает в раздел «Ещё», свёрнутый по умолчанию. Один механизм вместо двух, и главное — пункт
 * остаётся достижимым. Пункт, которого нет нигде, — это раздел, к которому нет двери, а такого в
 * навигации быть не должно.
 */
export type SidebarSection = 'main' | 'knowledge' | 'more';

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = ['main', 'knowledge', 'more'];

export const SECTION_TITLES: Record<SidebarSection, string> = {
  main: 'Основное',
  knowledge: 'База знаний',
  more: 'Ещё',
};

export interface SidebarLayout {
  /** Порядок внутри раздела: пути. Пункт, которого нет ни в одном списке, стоит в своём заводском. */
  order: Record<SidebarSection, string[]>;
  /** Свои названия: путь → имя. Пусто — заводское. */
  labels: Record<string, string>;
  /** Свёрнутые разделы. */
  collapsed: SidebarSection[];
}

export const EMPTY_LAYOUT: SidebarLayout = {
  order: { main: [], knowledge: [], more: [] },
  labels: {},
  collapsed: ['more'],
};

/**
 * Ключ тот же, что у прежнего порядка, и это осознанно: он уже перечислен в синхронизируемых, то
 * есть настройка меню и так переезжает между устройствами. Прежнее значение — `{ main, knowledge }`
 * — читается как есть: недостающие поля берутся из пустой раскладки, ничего не теряется и мигрировать
 * нечего.
 */
const STORAGE_KEY = 'medassist:sidebar-order';

const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);

export function readLayout(): SidebarLayout {
  try {
    const raw = readSetting(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<SidebarLayout> & { main?: unknown; knowledge?: unknown };
    // Прежняя запись держала порядок прямо в корне; новая — в `order`.
    const order = (parsed.order ?? { main: parsed.main, knowledge: parsed.knowledge }) as Record<string, unknown>;
    const labels: Record<string, string> = {};
    for (const [path, label] of Object.entries(parsed.labels ?? {})) {
      if (typeof label === 'string' && label.trim()) labels[path] = label;
    }
    return {
      order: {
        main: stringArray(order?.main),
        knowledge: stringArray(order?.knowledge),
        more: stringArray(order?.more),
      },
      labels,
      collapsed: Array.isArray(parsed.collapsed)
        ? (parsed.collapsed.filter((s) => SIDEBAR_SECTIONS.includes(s as SidebarSection)) as SidebarSection[])
        : EMPTY_LAYOUT.collapsed,
    };
  } catch {
    return EMPTY_LAYOUT;
  }
}

export interface SidebarItem {
  path: string;
  /** Заводское название — под ним пункт живёт, пока врач не переименовал. */
  label: string;
  /** Где пункт лежит, пока его не переложили. */
  section: SidebarSection;
}

/**
 * Раскладывает пункты по разделам: сначала то, что названо в сохранённом порядке, потом остальные
 * в заводском.
 *
 * Дописывание в конец — то же правило, что у карточек дашборда (`orderWidgets`), и по той же
 * причине: раздел, добавленный новым релизом, обязан появиться у того, кто меню однажды настроил.
 * Иначе он был бы невидим ровно для тех, кому мы его и привезли.
 */
export function arrangeSidebar<T extends SidebarItem>(items: T[], layout: SidebarLayout): Record<SidebarSection, T[]> {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const placed = new Set<string>();
  const result: Record<SidebarSection, T[]> = { main: [], knowledge: [], more: [] };

  for (const section of SIDEBAR_SECTIONS) {
    for (const path of layout.order[section] ?? []) {
      const item = byPath.get(path);
      if (!item || placed.has(path)) continue;
      placed.add(path);
      result[section].push(item);
    }
  }

  for (const item of items) {
    if (placed.has(item.path)) continue;
    result[item.section].push(item);
  }

  return result;
}

/** Название пункта: своё, если врач его дал, иначе заводское. */
export function labelOf(item: SidebarItem, layout: SidebarLayout): string {
  return layout.labels[item.path]?.trim() || item.label;
}

export function useSidebarLayout() {
  const [layout, setLayout] = useState<SidebarLayout>(() => readLayout());

  const save = useCallback((next: SidebarLayout) => {
    writeSetting(STORAGE_KEY, JSON.stringify(next));
    setLayout(next);
  }, []);

  /**
   * Записывается раскладка **целиком**, а не только тронутый раздел.
   *
   * Пункт, которого нет ни в одном списке, стоит в заводском разделе, и после переноса одного
   * пункта соседи остались бы «неназванными»: их место определялось бы заводским списком, а не тем,
   * что врач видит на экране. Явная запись всех трёх разделов убирает это разночтение.
   */
  const setArrangement = useCallback(
    (arrangement: Record<SidebarSection, { path: string }[]>) => {
      save({
        ...layout,
        order: {
          main: arrangement.main.map((i) => i.path),
          knowledge: arrangement.knowledge.map((i) => i.path),
          more: arrangement.more.map((i) => i.path),
        },
      });
    },
    [layout, save],
  );

  const rename = useCallback(
    (path: string, label: string) => {
      const labels = { ...layout.labels };
      // Пустое имя — это отказ от своего, а не пункт без названия.
      if (label.trim()) labels[path] = label.trim();
      else delete labels[path];
      save({ ...layout, labels });
    },
    [layout, save],
  );

  const toggleSection = useCallback(
    (section: SidebarSection) => {
      const collapsed = layout.collapsed.includes(section)
        ? layout.collapsed.filter((s) => s !== section)
        : [...layout.collapsed, section];
      save({ ...layout, collapsed });
    },
    [layout, save],
  );

  const reset = useCallback(() => {
    removeSetting(STORAGE_KEY);
    setLayout(EMPTY_LAYOUT);
  }, []);

  const customised =
    SIDEBAR_SECTIONS.some((section) => layout.order[section].length > 0) || Object.keys(layout.labels).length > 0;

  return { layout, setArrangement, rename, toggleSection, reset, customised };
}
