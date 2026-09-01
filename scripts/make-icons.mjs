#!/usr/bin/env node
/**
 * Значки приложения — из того же знака, что стоит в шапке.
 *
 * Рисуются скриптом, а не лежат картинками «откуда-то»: стетоскоп Tabler и градиент `brand.6` →
 * `brand.8` — ровно то, что видно в левом верхнем углу приложения, и при смене фирменного цвета
 * значок обязан поехать за ним, а не остаться прежним.
 *
 * Три разных значка, и разница не косметическая:
 *
 * - `any` (192, 512) — скруглённый квадрат с **прозрачными** углами. Прежние были сохранены без
 *   альфа-канала, и углы за скруглением оставались непрозрачно белыми: на панели задач и во вкладке
 *   вокруг значка стояла белая рамка.
 * - `maskable` — фон во всю площадь, значок в безопасной зоне (круг в 80% стороны): форму вырежет
 *   система, и скруглять самим нечего.
 * - `apple-touch-icon` — непрозрачный квадрат во всю площадь: iOS накладывает маску сам, а
 *   прозрачность заливает **чёрным**, то есть прозрачные углы дали бы чёрную рамку.
 *
 * Запуск (playwright-core в зависимостях приложения не держим — значки меняются раз в год):
 *
 *   npm i --no-save playwright-core && node scripts/make-icons.mjs
 *
 * Путь к Chromium берётся из `CHROMIUM`, если браузер стоит не там, где его ищет playwright.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Те же цвета, что у знака в шапке: `brand.6` → `brand.8` под 135°. */
const FROM = '#4c6fff';
const TO = '#3049c2';

/** Стетоскоп из Tabler — тот же значок, что в шапке. */
const GLYPH = `
  <path d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" />
  <path d="M8 15a6 6 0 1 0 12 0v-3" />
  <path d="M11 3v2" />
  <path d="M6 3v2" />
  <path d="M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
`;

/**
 * @param size    сторона в пикселях
 * @param radius  скругление в долях стороны; 0 — квадрат во всю площадь
 * @param glyph   доля стороны под сам значок
 */
function svg(size, radius, glyph) {
  const r = Math.round(size * radius);
  const g = Math.round(size * glyph);
  const offset = Math.round((size - g) / 2);
  const scale = g / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${FROM}"/>
      <stop offset="1" stop-color="${TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#ffffff"
     stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>
</svg>`;
}

const JOBS = [
  { file: 'icon-192.png', size: 192, radius: 0.22, glyph: 0.5 },
  { file: 'icon-512.png', size: 512, radius: 0.22, glyph: 0.5 },
  { file: 'icon-maskable-512.png', size: 512, radius: 0, glyph: 0.4 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, glyph: 0.5 },
];

// Векторный значок пишется без браузера — он и есть исходник.
writeFileSync(join(OUT, 'favicon.svg'), svg(32, 0.22, 0.56) + '\n');
console.log('favicon.svg записан');

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Нужен playwright-core: npm i --no-save playwright-core');
  process.exit(1);
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const job of JOBS) {
  const page = await browser.newPage({ viewport: { width: job.size, height: job.size } });
  await page.setContent(
    `<style>html,body{margin:0;padding:0;background:transparent}</style>${svg(job.size, job.radius, job.glyph)}`,
  );
  const buffer = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: job.size, height: job.size },
  });
  writeFileSync(join(OUT, job.file), buffer);
  console.log(job.file, buffer.length, 'байт');
  await page.close();
}
await browser.close();
