import { describe, expect, it } from 'vitest';

import {
  arrangeSidebar,
  EMPTY_LAYOUT,
  folderKey,
  labelOf,
  toStructure,
  type SidebarEntry,
  type SidebarItem,
  type SidebarLayout,
} from './useSidebarLayout';

const items: SidebarItem[] = [
  { path: '/dashboard', label: 'Дашборд', section: 'main' },
  { path: '/analyzer', label: 'Анализы', section: 'main' },
  { path: '/calculators', label: 'Калькуляторы', section: 'main' },
  { path: '/patients', label: 'Пациенты', section: 'main' },
  { path: '/news', label: 'Новости медицины', section: 'knowledge' },
  { path: '/library', label: 'Библиотека', section: 'knowledge' },
];

const layout = (patch: Partial<SidebarLayout>): SidebarLayout => ({
  ...EMPTY_LAYOUT,
  ...patch,
  order: { ...EMPTY_LAYOUT.order, ...(patch.order ?? {}) },
});

const names = (entries: SidebarEntry<SidebarItem>[]) =>
  entries.map((entry) => (entry.kind === 'item' ? entry.item.path : `${entry.folder.title}(${entry.items.map((i) => i.path).join(',')})`));

/** Каждый пункт приложения показан ровно один раз — инвариант, ради которого всё и написано. */
const shownPaths = (arranged: Record<string, SidebarEntry<SidebarItem>[]>) =>
  Object.values(arranged)
    .flat()
    .flatMap((entry) => (entry.kind === 'item' ? [entry.item.path] : entry.items.map((i) => i.path)));

describe('раскладка бокового меню', () => {
  it('без настройки всё стоит по заводским разделам', () => {
    const result = arrangeSidebar(items, EMPTY_LAYOUT);
    expect(names(result.main)).toEqual(['/dashboard', '/analyzer', '/calculators', '/patients']);
    expect(names(result.knowledge)).toEqual(['/news', '/library']);
    expect(result.more).toEqual([]);
  });

  it('новый пункт приложения появляется, даже когда меню давно настроено', () => {
    const stored = layout({ order: { main: ['/patients', '/dashboard'], knowledge: [], more: [] } });
    const withNew = [...items, { path: '/store', label: 'Магазин', section: 'main' as const }];
    expect(names(arrangeSidebar(withNew, stored).main)).toEqual([
      '/patients',
      '/dashboard',
      '/analyzer',
      '/calculators',
      '/store',
    ]);
  });

  it('убранное лежит в «Ещё», а не пропадает', () => {
    const result = arrangeSidebar(items, layout({ order: { main: [], knowledge: [], more: ['/library'] } }));
    expect(names(result.more)).toEqual(['/library']);
    expect(shownPaths(result)).toHaveLength(items.length);
  });

  describe('папки', () => {
    const withFolder = layout({
      order: { main: ['/dashboard', folderKey('f1'), '/patients'], knowledge: [], more: [] },
      folders: [{ id: 'f1', title: 'Инструменты', items: ['/analyzer', '/calculators'] }],
    });

    it('папка стоит на своём месте в разделе и держит свои пункты', () => {
      const result = arrangeSidebar(items, withFolder);
      expect(names(result.main)).toEqual(['/dashboard', 'Инструменты(/analyzer,/calculators)', '/patients']);
      expect(shownPaths(result)).toHaveLength(items.length);
    });

    it('пункт из папки не дублируется снаружи', () => {
      const result = arrangeSidebar(items, withFolder);
      expect(shownPaths(result).filter((p) => p === '/analyzer')).toHaveLength(1);
    });

    /* Имя без единой двери за ним ничего не открывает. */
    it('опустевшая папка не показывается', () => {
      const empty = layout({
        order: { main: [folderKey('f1'), '/dashboard'], knowledge: [], more: [] },
        folders: [{ id: 'f1', title: 'Пустая', items: [] }],
      });
      expect(names(arrangeSidebar(items, empty).main)).not.toContain('Пустая()');
      expect(shownPaths(arrangeSidebar(items, empty))).toHaveLength(items.length);
    });

    it('папка, потерявшая место в разделе, не уносит с собой пункты', () => {
      const orphan = layout({
        order: { main: ['/dashboard'], knowledge: [], more: [] },
        folders: [{ id: 'f1', title: 'Осиротевшая', items: ['/analyzer', '/calculators'] }],
      });
      const result = arrangeSidebar(items, orphan);
      expect(names(result.main)).toEqual(['/dashboard', '/analyzer', '/calculators', '/patients']);
      expect(shownPaths(result)).toHaveLength(items.length);
    });

    it('путь, названный и в папке, и в разделе, показывается один раз', () => {
      const twice = layout({
        order: { main: [folderKey('f1'), '/analyzer'], knowledge: [], more: [] },
        folders: [{ id: 'f1', title: 'Инструменты', items: ['/analyzer'] }],
      });
      expect(shownPaths(arrangeSidebar(items, twice)).filter((p) => p === '/analyzer')).toHaveLength(1);
    });

    it('папка может лежать и в «Ещё»', () => {
      const hidden = layout({
        order: { main: [], knowledge: [], more: [folderKey('f1')] },
        folders: [{ id: 'f1', title: 'Редкое', items: ['/library'] }],
      });
      expect(names(arrangeSidebar(items, hidden).more)).toEqual(['Редкое(/library)']);
    });

    it('то, что нарисовано, тем же и сохраняется', () => {
      const result = arrangeSidebar(items, withFolder);
      const structure = toStructure(result);
      expect(structure.main).toEqual([
        { kind: 'item', path: '/dashboard' },
        { kind: 'folder', id: 'f1', title: 'Инструменты', paths: ['/analyzer', '/calculators'] },
        { kind: 'item', path: '/patients' },
      ]);
    });
  });

  it('своё название заменяет заводское, пустое — возвращает заводское', () => {
    const item = items[1];
    expect(labelOf(item, layout({ labels: { '/analyzer': 'Лаборатория' } }))).toBe('Лаборатория');
    expect(labelOf(item, layout({ labels: { '/analyzer': '  ' } }))).toBe('Анализы');
  });
});
