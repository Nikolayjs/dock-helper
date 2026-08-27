/**
 * Обои рабочей области и палитра, которую они задают.
 *
 * Хранится в `localStorage`, рядом с раскладкой дашборда, порядком пунктов сайдбара и зумом
 * читалки, и по той же причине: это настройка, а не данные, и ради неё не стоит менять схему базы с
 * записями пациентов. Цена та же — обои принадлежат одному браузеру.
 *
 * Картинка лежит здесь же строкой `data:`, а не в базе и не в загрузках на сервере: перед записью
 * она уменьшается до 1600 px и пережимается в JPEG, и обычный снимок весит около двух-трёх сотен
 * килобайт. Всё, что после сжатия не уложилось в потолок, отвергается с внятным отказом — молча
 * не записаться хуже, чем не принять.
 */

const STORAGE_KEY = 'medassist:appearance';

/** Больше уменьшать нет смысла: обои показываются размытым фоном под сплошными карточками. */
export const WALLPAPER_MAX_DIMENSION = 1600;

/** Потолок для одной картинки. `localStorage` даёт около 5 МБ на всё приложение. */
export const WALLPAPER_MAX_BYTES = 1_500_000;

export interface WallpaperPreset {
  id: string;
  label: string;
  /** Значение для `background-image`. */
  image: string;
  /** Цвет, по которому строится палитра: у заготовок он известен, считать его неоткуда. */
  accent: string;
}

/**
 * Заготовки — это градиенты, а не картинки, и это осознанно: они ничего не весят, одинаково
 * выглядят на любом экране и не требуют распознавания цвета — он у них назван.
 */
export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'clinic',
    label: 'Клиника',
    image: 'linear-gradient(135deg, #4c6fff 0%, #7aa2ff 45%, #a8c6ff 100%)',
    accent: '#4c6fff',
  },
  {
    id: 'mint',
    label: 'Мята',
    image: 'linear-gradient(135deg, #0bb684 0%, #49d7ab 50%, #b6f0dc 100%)',
    accent: '#1ecd98',
  },
  {
    id: 'sunrise',
    label: 'Рассвет',
    image: 'linear-gradient(135deg, #ff8a3d 0%, #ff6b8a 55%, #ffc4a3 100%)',
    accent: '#f2683c',
  },
  {
    id: 'lavender',
    label: 'Лаванда',
    image: 'linear-gradient(135deg, #7b5cd6 0%, #a68bf0 50%, #ddd2ff 100%)',
    accent: '#7b5cd6',
  },
  {
    id: 'graphite',
    label: 'Графит',
    image: 'linear-gradient(135deg, #3a3f4b 0%, #5a6270 50%, #97a1b0 100%)',
    accent: '#5a6270',
  },
  {
    id: 'sea',
    label: 'Море',
    image: 'linear-gradient(135deg, #0c7c92 0%, #2bb3c0 50%, #a7e6ec 100%)',
    accent: '#0f96ab',
  },
];

export type Wallpaper =
  | { kind: 'none' }
  | { kind: 'preset'; id: string }
  /** `accent` — `null`, если картинка чёрно-белая: подстраивать палитру не под что. */
  | { kind: 'custom'; dataUrl: string; accent: string | null };

export interface AppearanceSettings {
  wallpaper: Wallpaper;
  /**
   * Насколько обои приглушены полупрозрачной подложкой, 0…0,9.
   *
   * Подложка обязательна: под обоями лежит не только оснастка, но и мелкий текст, который живёт
   * прямо на фоне страницы — счётчики списков и названия вкладок. Измерено на десяти разделах: таких
   * надписей от одной до шести на страницу, всё содержательное — на сплошных карточках.
   *
   * Ползунок есть потому, что полупрозрачная подложка **не даёт гарантии**: она смешивает, а не
   * ограничивает снизу, и на тёмном снимке в светлой теме приглушённая подпись теряется при любой
   * прозрачности, кроме полной. Заготовки-градиенты такого не устраивают — они светлые и написаны
   * здесь; своя фотография может, и тогда её надо приглушить сильнее. Значение по умолчанию выбрано
   * так, чтобы обычный снимок среднего тона был безопасен без правки ползунка.
   */
  veil: number;
  /** Подстраивать ли палитру приложения под цвет обоев. */
  tint: boolean;
}

export const DEFAULT_VEIL = 0.75;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  wallpaper: { kind: 'none' },
  veil: DEFAULT_VEIL,
  tint: true,
};

function isWallpaper(value: unknown): value is Wallpaper {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'none') return true;
  if (kind === 'preset') return typeof (value as { id?: unknown }).id === 'string';
  if (kind === 'custom') return typeof (value as { dataUrl?: unknown }).dataUrl === 'string';
  return false;
}

export function readAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      wallpaper: isWallpaper(parsed.wallpaper) ? parsed.wallpaper : DEFAULT_APPEARANCE.wallpaper,
      veil: typeof parsed.veil === 'number' ? Math.min(0.9, Math.max(0, parsed.veil)) : DEFAULT_VEIL,
      tint: typeof parsed.tint === 'boolean' ? parsed.tint : DEFAULT_APPEARANCE.tint,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export class WallpaperTooLargeError extends Error {}

export function writeAppearance(settings: AppearanceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Место в хранилище кончилось. Молчать нельзя: врач выбрал обои, а они не сохранились.
    throw new WallpaperTooLargeError('Не хватило места в хранилище браузера. Попробуйте картинку поменьше.');
  }
}

/** Цвет, по которому строится палитра, — или `null`, если обои его не задают. */
export function accentOf(wallpaper: Wallpaper): string | null {
  if (wallpaper.kind === 'preset') return WALLPAPER_PRESETS.find((preset) => preset.id === wallpaper.id)?.accent ?? null;
  if (wallpaper.kind === 'custom') return wallpaper.accent;
  return null;
}

/** Значение для `background-image` — или `null`, если обоев нет. */
export function imageOf(wallpaper: Wallpaper): string | null {
  if (wallpaper.kind === 'preset') return WALLPAPER_PRESETS.find((preset) => preset.id === wallpaper.id)?.image ?? null;
  if (wallpaper.kind === 'custom') return `url("${wallpaper.dataUrl}")`;
  return null;
}
