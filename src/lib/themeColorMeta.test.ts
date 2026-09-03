import { afterEach, describe, expect, it } from 'vitest';

import { THEME_COLOR_COOKIE, THEME_COLOR_STORAGE_KEY, syncThemeColorMeta, themeColorCookie, toHexColor } from './themeColorMeta';

describe('цвет шапки для полосы окна', () => {
  it('обычный rgb — в шестнадцатеричную запись', () => {
    expect(toHexColor('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(toHexColor('rgb(36, 36, 36)')).toBe('#242424');
  });

  /* Под обоями поверхность считается через `color-mix`, и браузер отдаёт её именно так. */
  it('color(srgb …) — тоже: это то, что возвращает подкрашенная обоями шапка', () => {
    expect(toHexColor('color(srgb 0.188392 0.151333 0.137882)')).toBe('#302723');
    expect(toHexColor('color(srgb 1 1 1)')).toBe('#ffffff');
  });

  it('непрозрачность близкая к единице — всё ещё сплошной цвет', () => {
    expect(toHexColor('rgba(36, 36, 36, 1)')).toBe('#242424');
    expect(toHexColor('color(srgb 0.1 0.1 0.1 / 0.95)')).toBe('#1a1a1a');
  });

  /* Полупрозрачное системе отдавать нельзя: она нарисует сплошную полосу непонятно какого цвета. */
  it('полупрозрачное отвергается', () => {
    expect(toHexColor('rgba(0, 0, 0, 0)')).toBeNull();
    expect(toHexColor('rgba(36, 36, 36, 0.4)')).toBeNull();
    expect(toHexColor('color(srgb 0.1 0.1 0.1 / 0.5)')).toBeNull();
  });

  it('незнакомое не подставляется наугад — тогда работают меты из index.html', () => {
    expect(toHexColor('оранжевый')).toBeNull();
    expect(toHexColor('lab(50% 40 59.5)')).toBeNull();
    expect(toHexColor('')).toBeNull();
  });

  it('шестнадцатеричное пропускается как есть', () => {
    expect(toHexColor('#242424')).toBe('#242424');
    expect(toHexColor('#FFFFFF')).toBe('#ffffff');
  });
});

describe('мета и запомненный цвет', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    localStorage.clear();
  });

  const mountHeader = (background: string) => {
    const header = document.createElement('header');
    header.className = 'mantine-AppShell-header';
    header.style.backgroundColor = background;
    document.body.append(header);
  };

  it('мета встаёт первой в head и цвет записывается на устройство', () => {
    document.head.innerHTML =
      '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />';
    mountHeader('rgb(36, 36, 36)');

    syncThemeColorMeta();

    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    expect(metas).toHaveLength(2);
    expect(metas[0].content).toBe('#242424');
    expect(metas[0].hasAttribute('data-app-theme-color')).toBe(true);
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe('#242424');
    // Кука — для манифеста: по ней сервер ставит `theme_color`, которым Android красит бар.
    expect(document.cookie).toContain(`${THEME_COLOR_COOKIE}=%23242424`);
  });

  it('кука: год жизни, весь сайт, Secure только на https', () => {
    expect(themeColorCookie('#242424', true)).toBe(
      'medassist-theme-color=%23242424; path=/; max-age=31536000; SameSite=Lax; Secure',
    );
    expect(themeColorCookie('#ffffff', false)).not.toContain('Secure');
  });

  /*
   * Ровно это делает inline-скрипт из `index.html` при запуске: он ставит мету с тем же признаком.
   * Расчёт по живой шапке обязан **уточнить** её, а не завести вторую — иначе на странице стояли бы
   * две меты приложения, и какая из них победит, решал бы порядок.
   */
  it('мету, поставленную при запуске, расчёт уточняет, а не дублирует', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#242424" data-app-theme-color="" />';
    mountHeader('rgb(255, 255, 255)');

    syncThemeColorMeta();

    const metas = document.head.querySelectorAll<HTMLMetaElement>('meta[data-app-theme-color]');
    expect(metas).toHaveLength(1);
    expect(metas[0].content).toBe('#ffffff');
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe('#ffffff');
  });

  it('без шапки ничего не трогается: публичный сайт живёт метами из index.html', () => {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, '#242424');

    syncThemeColorMeta();

    expect(document.head.querySelector('meta[data-app-theme-color]')).toBeNull();
    expect(localStorage.getItem(THEME_COLOR_STORAGE_KEY)).toBe('#242424');
  });
});
