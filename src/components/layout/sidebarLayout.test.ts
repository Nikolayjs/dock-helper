import { describe, expect, it } from 'vitest';

import { arrangeSidebar, labelOf, EMPTY_LAYOUT, type SidebarItem, type SidebarLayout } from './useSidebarLayout';

const items: SidebarItem[] = [
  { path: '/dashboard', label: 'Дашборд', section: 'main' },
  { path: '/patients', label: 'Пациенты', section: 'main' },
  { path: '/drugs', label: 'Лекарственные препараты', section: 'main' },
  { path: '/news', label: 'Новости медицины', section: 'knowledge' },
  { path: '/library', label: 'Библиотека', section: 'knowledge' },
];

const layout = (patch: Partial<SidebarLayout>): SidebarLayout => ({
  ...EMPTY_LAYOUT,
  ...patch,
  order: { ...EMPTY_LAYOUT.order, ...(patch.order ?? {}) },
});

const paths = (list: SidebarItem[]) => list.map((i) => i.path);

describe('раскладка бокового меню', () => {
  it('без настройки всё стоит по заводским разделам и в заводском порядке', () => {
    const result = arrangeSidebar(items, EMPTY_LAYOUT);
    expect(paths(result.main)).toEqual(['/dashboard', '/patients', '/drugs']);
    expect(paths(result.knowledge)).toEqual(['/news', '/library']);
    expect(result.more).toEqual([]);
  });

  it('сохранённый порядок идёт первым, неназванные пункты дописываются в конец своего раздела', () => {
    const result = arrangeSidebar(items, layout({ order: { main: ['/drugs'], knowledge: [], more: [] } }));
    expect(paths(result.main)).toEqual(['/drugs', '/dashboard', '/patients']);
  });

  /* Раздел, добавленный новым релизом, обязан появиться у того, кто меню однажды настроил. */
  it('новый пункт приложения появляется, даже когда меню давно настроено', () => {
    const stored = layout({ order: { main: ['/patients', '/dashboard'], knowledge: ['/news'], more: [] } });
    const withNew = [...items, { path: '/store', label: 'Магазин', section: 'main' as const }];
    const result = arrangeSidebar(withNew, stored);
    expect(paths(result.main)).toEqual(['/patients', '/dashboard', '/drugs', '/store']);
    expect(paths(result.knowledge)).toEqual(['/news', '/library']);
  });

  it('пункт переезжает в другой раздел — он больше не считается своим заводским', () => {
    const result = arrangeSidebar(items, layout({ order: { main: [], knowledge: ['/drugs'], more: [] } }));
    expect(paths(result.main)).toEqual(['/dashboard', '/patients']);
    expect(paths(result.knowledge)).toEqual(['/drugs', '/news', '/library']);
  });

  /* Спрятать — это переложить в «Ещё»: пункт остаётся достижимым, а не исчезает. */
  it('убранное лежит в «Ещё», а не пропадает', () => {
    const result = arrangeSidebar(items, layout({ order: { main: [], knowledge: [], more: ['/library', '/drugs'] } }));
    expect(paths(result.more)).toEqual(['/library', '/drugs']);
    expect(paths(result.main)).toEqual(['/dashboard', '/patients']);
    expect(paths(result.knowledge)).toEqual(['/news']);
    // Ни один пункт не потерялся
    expect([...result.main, ...result.knowledge, ...result.more]).toHaveLength(items.length);
  });

  it('путь, названный в двух разделах, показывается один раз — в первом', () => {
    const result = arrangeSidebar(items, layout({ order: { main: ['/drugs'], knowledge: ['/drugs'], more: [] } }));
    expect(paths(result.main)).toContain('/drugs');
    expect(paths(result.knowledge)).not.toContain('/drugs');
  });

  it('путь, которого в приложении больше нет, просто не показывается', () => {
    const result = arrangeSidebar(items, layout({ order: { main: ['/graph', '/dashboard'], knowledge: [], more: [] } }));
    expect(paths(result.main)).toEqual(['/dashboard', '/patients', '/drugs']);
  });

  it('своё название заменяет заводское, пустое — возвращает заводское', () => {
    const item = items[2];
    expect(labelOf(item, layout({ labels: { '/drugs': 'Формуляр' } }))).toBe('Формуляр');
    expect(labelOf(item, layout({ labels: { '/drugs': '   ' } }))).toBe('Лекарственные препараты');
    expect(labelOf(item, EMPTY_LAYOUT)).toBe('Лекарственные препараты');
  });
});
