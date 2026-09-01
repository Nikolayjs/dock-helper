import { useCallback, useState } from 'react';

import { readSetting, removeSetting, writeSetting } from '../../lib/settingsStore';

/**
 * Боковое меню собирает врач: что где лежит, что во что вложено, что убрано и как называется.
 *
 * Разделов в приложении семнадцать, и они одинаковы для всех — а нужны разные: кардиолог не
 * открывает «Диагностику», терапевт не открывает «Библиотеку». Угадывать за врача, что ему не
 * нужно, мы уже пробовали в магазине и перестали.
 *
 * **Спрятать — значит переложить, а не пометить.** Отдельного флажка «скрыт» нет: убранный пункт
 * переезжает в раздел «Ещё», свёрнутый по умолчанию. Один механизм вместо двух, и главное — пункт
 * остаётся достижимым. Пункт, которого нет нигде, — это раздел, к которому нет двери.
 *
 * **Папки заводит врач, а не мы.** Название придумывает он же: «Инструменты» — это его слово, а не
 * наша таксономия. Ровно поэтому заводской группировки в меню нет вовсе.
 */
export type SidebarSection = 'main' | 'knowledge' | 'more';

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = ['main', 'knowledge', 'more'];

export const SECTION_TITLES: Record<SidebarSection, string> = {
  main: 'Основное',
  knowledge: 'База знаний',
  more: 'Ещё',
};

/** Папка в разделе: своё имя и список путей внутри. */
export interface SidebarFolder {
  id: string;
  title: string;
  items: string[];
}

export interface SidebarLayout {
  /** Что стоит в разделе: пути пунктов и папки (`folder:<id>`). */
  order: Record<SidebarSection, string[]>;
  folders: SidebarFolder[];
  /** Свои названия пунктов: путь → имя. Пусто — заводское. */
  labels: Record<string, string>;
  /** Свёрнутое: разделы (`main`) и папки (`folder:<id>`) — одним списком. */
  collapsed: string[];
}

export const EMPTY_LAYOUT: SidebarLayout = {
  order: { main: [], knowledge: [], more: [] },
  folders: [],
  labels: {},
  collapsed: ['more'],
};

export const FOLDER_PREFIX = 'folder:';
export const isFolderId = (id: string) => id.startsWith(FOLDER_PREFIX);
export const folderKey = (id: string) => `${FOLDER_PREFIX}${id}`;

/**
 * Ключ хранения тот же, что у прежнего порядка: он уже перечислен в синхронизируемых, то есть
 * настройка меню и так переезжает между устройствами. Прежние значения читаются как есть —
 * и `{ main, knowledge }` первой версии, и `{ order, labels, collapsed }` второй.
 */
const STORAGE_KEY = 'medassist:sidebar-order';

const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);

export function readLayout(): SidebarLayout {
  try {
    const raw = readSetting(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<SidebarLayout> & { main?: unknown; knowledge?: unknown };
    const order = (parsed.order ?? { main: parsed.main, knowledge: parsed.knowledge }) as Record<string, unknown>;

    const labels: Record<string, string> = {};
    for (const [path, label] of Object.entries(parsed.labels ?? {})) {
      if (typeof label === 'string' && label.trim()) labels[path] = label;
    }

    const folders: SidebarFolder[] = Array.isArray(parsed.folders)
      ? parsed.folders
          .filter((f): f is SidebarFolder => Boolean(f) && typeof f.id === 'string' && typeof f.title === 'string')
          .map((f) => ({ id: f.id, title: f.title, items: stringArray(f.items) }))
      : [];

    return {
      order: {
        main: stringArray(order?.main),
        knowledge: stringArray(order?.knowledge),
        more: stringArray(order?.more),
      },
      folders,
      labels,
      collapsed: stringArray(parsed.collapsed).length > 0 ? stringArray(parsed.collapsed) : EMPTY_LAYOUT.collapsed,
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

/** Строка раздела: либо пункт, либо папка со своими пунктами. */
export type SidebarEntry<T extends SidebarItem> =
  | { kind: 'item'; item: T }
  | { kind: 'folder'; folder: SidebarFolder; items: T[] };

/**
 * Раскладывает пункты по разделам и папкам.
 *
 * Инвариант один и он проверяется тестом: **каждый пункт приложения показан ровно один раз**. Всё
 * остальное — починка того, что могло разъехаться: путь, которого больше нет; папка, потерявшая
 * своё место в разделе; пункт, названный дважды. Молча потерять пункт нельзя — это раздел, к
 * которому не осталось двери.
 *
 * Не названные нигде дописываются в конец своего заводского раздела — то же правило, что у карточек
 * дашборда (`orderWidgets`), и по той же причине: раздел, добавленный новым релизом, обязан
 * появиться у того, кто меню однажды настроил.
 */
export function arrangeSidebar<T extends SidebarItem>(
  items: T[],
  layout: SidebarLayout,
): Record<SidebarSection, SidebarEntry<T>[]> {
  const byPath = new Map(items.map((item) => [item.path, item]));
  const placed = new Set<string>();
  const foldersById = new Map(layout.folders.map((folder) => [folder.id, folder]));
  const result: Record<SidebarSection, SidebarEntry<T>[]> = { main: [], knowledge: [], more: [] };

  for (const section of SIDEBAR_SECTIONS) {
    for (const id of layout.order[section] ?? []) {
      if (isFolderId(id)) {
        const folder = foldersById.get(id.slice(FOLDER_PREFIX.length));
        if (!folder) continue;
        const inside: T[] = [];
        for (const path of folder.items) {
          const item = byPath.get(path);
          if (!item || placed.has(path)) continue;
          placed.add(path);
          inside.push(item);
        }
        // Пустая папка не показывается: имя без единой двери за ним ничего не открывает.
        if (inside.length > 0) result[section].push({ kind: 'folder', folder, items: inside });
        continue;
      }

      const item = byPath.get(id);
      if (!item || placed.has(id)) continue;
      placed.add(id);
      result[section].push({ kind: 'item', item });
    }
  }

  for (const item of items) {
    if (placed.has(item.path)) continue;
    result[item.section].push({ kind: 'item', item });
  }

  return result;
}

/** Название пункта: своё, если врач его дал, иначе заводское. */
export function labelOf(item: SidebarItem, layout: SidebarLayout): string {
  return layout.labels[item.path]?.trim() || item.label;
}

/** То, что рисуется на экране, — в том же виде отдаётся на сохранение. */
export type SidebarStructure = Record<
  SidebarSection,
  ({ kind: 'item'; path: string } | { kind: 'folder'; id: string; title: string; paths: string[] })[]
>;

export function toStructure<T extends SidebarItem>(
  arranged: Record<SidebarSection, SidebarEntry<T>[]>,
): SidebarStructure {
  const map = (entries: SidebarEntry<T>[]) =>
    entries.map((entry) =>
      entry.kind === 'item'
        ? ({ kind: 'item', path: entry.item.path } as const)
        : ({ kind: 'folder', id: entry.folder.id, title: entry.folder.title, paths: entry.items.map((i) => i.path) } as const),
    );
  return { main: map(arranged.main), knowledge: map(arranged.knowledge), more: map(arranged.more) };
}

export function useSidebarLayout() {
  const [layout, setLayout] = useState<SidebarLayout>(() => readLayout());

  const save = useCallback((next: SidebarLayout) => {
    writeSetting(STORAGE_KEY, JSON.stringify(next));
    setLayout(next);
  }, []);

  /**
   * Записывается раскладка **целиком**, а не тронутый раздел.
   *
   * Пункт, которого нет ни в одном списке, стоит в заводском разделе, и после переноса одного пункта
   * соседи остались бы «неназванными»: их место определялось бы заводским списком, а не тем, что
   * врач видит на экране.
   */
  const setStructure = useCallback(
    (structure: SidebarStructure) => {
      const order: Record<SidebarSection, string[]> = { main: [], knowledge: [], more: [] };
      const folders: SidebarFolder[] = [];
      for (const section of SIDEBAR_SECTIONS) {
        for (const entry of structure[section]) {
          if (entry.kind === 'item') {
            order[section].push(entry.path);
            continue;
          }
          // Опустевшая папка не сохраняется: держать имя без содержимого незачем.
          if (entry.paths.length === 0) continue;
          order[section].push(folderKey(entry.id));
          folders.push({ id: entry.id, title: entry.title, items: entry.paths });
        }
      }
      save({ ...layout, order, folders });
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

  const renameFolder = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      save({ ...layout, folders: layout.folders.map((f) => (f.id === id ? { ...f, title: trimmed } : f)) });
    },
    [layout, save],
  );

  const toggle = useCallback(
    (key: string) => {
      const collapsed = layout.collapsed.includes(key)
        ? layout.collapsed.filter((k) => k !== key)
        : [...layout.collapsed, key];
      save({ ...layout, collapsed });
    },
    [layout, save],
  );

  const reset = useCallback(() => {
    removeSetting(STORAGE_KEY);
    setLayout(EMPTY_LAYOUT);
  }, []);

  const customised =
    SIDEBAR_SECTIONS.some((section) => layout.order[section].length > 0) ||
    Object.keys(layout.labels).length > 0 ||
    layout.folders.length > 0;

  return { layout, setStructure, rename, renameFolder, toggle, reset, customised };
}
