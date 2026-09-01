/**
 * Полоса заголовка установленного приложения красится в цвет **шапки приложения**.
 *
 * У окна PWA верхнюю полосу рисует система, а цвет берёт из `theme-color`. В манифесте стоял
 * фирменный синий — и на тёмной теме с тёплыми обоями врач получал ярко-синюю планку над
 * коричневым приложением: единственное место окна, не имеющее к нему никакого отношения.
 *
 * Статическим значением это не чинится: у приложения две темы и подкраска под обои, то есть цвет
 * шапки — не константа, а результат настроек врача. Поэтому цвет **спрашивается у самой шапки**:
 * что бы ни насчитали тема и обои, полоса окна получает ровно то же. Двух источников правды при
 * этом не появляется — источник один, и он же нарисован на экране.
 *
 * До первой отрисовки и на публичном сайте, где шапки приложения нет вовсе, работают две меты из
 * `index.html`, объявленные через `media`: светлая и тёмная. **Своя мета вставляется первой** —
 * браузер берёт первую подходящую по документу, — и появляется только тогда, когда есть что в неё
 * записать: пустая или поставленная заранее, она перебила бы обе объявленные и покрасила полосу
 * не тем.
 */

const MARK = 'data-app-theme-color';

/**
 * Цвет шапки — в `#rrggbb`, и это не косметика.
 *
 * Под обоями поверхность считается через `color-mix`, а такой цвет браузер возвращает записью
 * `color(srgb 0.188 0.151 0.138)`. Спецификация `theme-color` принимает любой CSS-цвет, но
 * полагаться на то, что его разберёт и **система**, рисующая полосу окна, не стоит: не разберёт —
 * полоса останется прежней, и понять почему будет не по чему. Шестнадцатеричную запись понимают
 * все.
 *
 * Возвращает `null` для всего, чего не знает, — и для полупрозрачного: система ждёт сплошной цвет,
 * а шапка приложения сплошная всегда.
 */
export function toHexColor(color: string): string | null {
  const hex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  const rgb = color.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.%]+)\s*)?\)$/i);
  if (rgb) {
    const alpha = rgb[4];
    if (alpha !== undefined && Number.parseFloat(alpha) < (alpha.endsWith('%') ? 90 : 0.9)) return null;
    return hex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  const srgb = color.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/i);
  if (srgb) {
    if (srgb[4] !== undefined && Number(srgb[4]) < 0.9) return null;
    return hex(Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255);
  }

  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

export function syncThemeColorMeta(): void {
  const header = document.querySelector<HTMLElement>('[class*="AppShell-header"]');
  if (!header) return;

  const color = toHexColor(getComputedStyle(header).backgroundColor);
  if (!color) return;

  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${MARK}]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.setAttribute(MARK, '');
    document.head.prepend(meta);
  }
  if (meta.content !== color) meta.content = color;
}
