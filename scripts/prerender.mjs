/**
 * Renders the public pages to real HTML after the build.
 *
 * `curl https://medhelpmate.ru/` has to come back with the landing text, not an empty
 * `<div id="root">`. A single-page application gives a crawler exactly that empty div, and the
 * one page on this site that anyone will ever link to from outside is the public one.
 *
 * Deliberately hand-written rather than a plugin: `vite-plugin-prerender` has been unmaintained
 * for years and does not run under Vite 8. What is needed here is fifty lines — render five
 * addresses, put each into the built `index.html`, write it where the static server will find it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SSR_ENTRY = pathToFileURL(path.join(ROOT, 'dist-ssr', 'entry-server.js')).href;

const { render, PUBLIC_PAGES, SITE_ORIGIN } = await import(SSR_ENTRY);

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

/**
 * The stylesheet of the public bundle.
 *
 * Vite links only the entry's own CSS from `index.html`; everything else is fetched by the chunk
 * loader, i.e. by JavaScript. Without adding this link the prerendered page would arrive correct
 * but completely unstyled, and stay that way until the bundle boots.
 */
const manifest = JSON.parse(fs.readFileSync(path.join(DIST, '.vite', 'manifest.json'), 'utf8'));
const publicCss = [
  ...new Set(
    Object.entries(manifest)
      .filter(([name]) => name.includes('PublicRoot'))
      .flatMap(([, chunk]) => chunk.css ?? []),
  ),
];
if (publicCss.length === 0) throw new Error('в манифесте не нашлось стилей публичной части');

/** Запасной блок метатегов в `index.html`: пререндер меняет его целиком на страничный. */
const META_BLOCK = /<!-- prerender:meta:start -->[\s\S]*?<!-- prerender:meta:end -->/;

/**
 * Отключает пререндер, если документ достался не своему адресу.
 *
 * Статический сервер отдаёт `index.html` на **любой** неизвестный путь — так работает
 * одностраничное приложение. А `index.html` — это и есть пререндеренный лендинг, и значит на
 * `/app/documents/…/edit` и на `/login` он на мгновение показывался поверх всего, пока не
 * загрузится и не отрисуется приложение. Ровно это и было видно при обновлении залогиненной
 * страницы.
 *
 * Скрипт стоит в `<head>`, то есть отрабатывает **до** разбора разметки: браузеру не приходится
 * рисовать её, чтобы потом убрать. Заодно снимается лист стилей публичной части — приложению он не
 * нужен и весит десять килобайт.
 *
 * Прятать по классу на `#root` нельзя: React рисует приложение в тот же узел, и правило погасило бы
 * заодно и его. Поэтому разметка завёрнута в свой `[data-prerender]`, который React при первом
 * рендере выбрасывает целиком.
 */
const guard = (ownPath) => {
  const own = ownPath === '/' ? '' : ownPath;
  return [
    '<script>',
    '      (function () {',
    '        var here = location.pathname;',
    "        if (here.length > 1 && here.charAt(here.length - 1) === '/') here = here.slice(0, -1);",
    "        if (here === '" + own + "') return;",
    "        document.head.insertAdjacentHTML('beforeend', '<style>[data-prerender]{display:none}</style>');",
    "        document.querySelectorAll('link[data-prerender]').forEach(function (link) { link.remove(); });",
    '      })();',
    '    </script>',
  ].join(String.fromCharCode(10));
};

const escapeAttribute = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

let written = 0;
for (const page of PUBLIC_PAGES) {
  const markup = render(page.path);
  // Проверка на месте, а не в тестах: пререндер молча отдающий пустую страницу — это ровно та
  // поломка, ради которой он и заводился, и заметить её потом можно только через `curl` на проде.
  if (markup.length < 500) throw new Error(`${page.path}: разметка вышла пустой (${markup.length} байт)`);

  const canonical = `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`;
  const head = [
    `<title>${escapeAttribute(page.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(page.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="MedAssist" />`,
    `<meta property="og:locale" content="ru_RU" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:title" content="${escapeAttribute(page.title)}" />`,
    `<meta property="og:description" content="${escapeAttribute(page.description)}" />`,
    `<meta property="og:image" content="${SITE_ORIGIN}/landing/og.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeAttribute(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeAttribute(page.description)}" />`,
    `<meta name="twitter:image" content="${SITE_ORIGIN}/landing/og.png" />`,
    ...publicCss.map((file) => `<link rel="stylesheet" crossorigin data-prerender href="/${file}" />`),
    guard(page.path),
  ].join('\n    ');

  // Запасной блок метатегов вырезается целиком, а не дополняется: рядом со страничным он давал
  // два canonical и два og:title на одной странице, а два канонических адреса — это ни одного.
  const withHead = template.replace(META_BLOCK, head);
  if (withHead === template) throw new Error('в шаблоне не нашлось блока prerender:meta');
  const html = withHead.replace('<div id="root"></div>', `<div id="root"><div data-prerender>${markup}</div></div>`);

  const outDir = page.path === '/' ? DIST : path.join(DIST, page.path);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  written += 1;
  console.log(`  ${page.path.padEnd(16)} ${(markup.length / 1024).toFixed(1)} КБ разметки`);
}
console.log(`пререндер: ${written} страниц, стили ${publicCss.join(', ')}`);
